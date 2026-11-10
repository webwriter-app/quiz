import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { type OptionDeclaration } from "@webwriter/lit";
import PlusIcon from "bootstrap-icons/icons/plus.svg";
import UiChecksIcon from "bootstrap-icons/icons/ui-checks.svg";
import UiRadiosIcon from "bootstrap-icons/icons/ui-radios.svg";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { name as packageId } from "../../../package.json";
import { registerQuizType } from "../../api";
import { DraggableGrid, DraggableGridReorderEvent } from "../../lib/draggable-grid";
import { encryptedProperty, encryptPlaintextAttributes } from "../../lib/encrypted-property";
import { QuizItems } from "../../lib/quiz-items";
import { mutateWithStableSelection } from "../../lib/webwriter-quirks";
import type { WebwriterChoiceItem } from "./webwriter-choice-item";
import { messageFor } from "../../lib/localization";
import { WebwriterTask } from "../webwriter-task";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-choice": WebwriterChoice;
	}
}

export type ChoiceMode = "single" | "multiple";
export type ChoiceLayout = "list" | "tiles";
export type ChoiceGradingMethod = "pass-fail" | "partial";
export type ChoiceSolution = { [id: string]: boolean };

function createChoice(mode: ChoiceMode) {
	const choice = document.createElement("webwriter-choice");
	choice.setAttribute("mode", mode);
	const item = document.createElement("webwriter-choice-item");
	item.append(document.createElement("p"));
	choice.append(item);
	return choice;
}

registerQuizType({
	packageId,
	widgetPosition: 2,
	id: "webwriter-single-choice",
	getName: (locale, translate = messageFor(locale)) => translate("Single Choice"),
	icon: UiRadiosIcon,
	createInstance: () => createChoice("single"),
});

registerQuizType({
	packageId,
	widgetPosition: 3,
	id: "webwriter-multiple-choice",
	getName: (locale, translate = messageFor(locale)) => translate("Multiple Choice"),
	icon: UiChecksIcon,
	createInstance: () => createChoice("multiple"),
});

/**
 * An answer where learners pick one or more options.
 *
 * The options must be `<webwriter-choice-item>` elements assigned to the
 * default slot.
 */
@customElement("webwriter-choice")
export class WebwriterChoice extends WebwriterTask {
	static shadowRootOptions: ShadowRootInit = { ...WebwriterTask.shadowRootOptions, slotAssignment: "manual" };

	/** @internal */
	get actions() {
		return {
			...super.actions,
			addOption: { label: { _: this.msg("Add Option") } },
		};
	}

	/** @internal */
	get options(): Record<string, OptionDeclaration> {
		return {
			...super.options,
			"mode": {
				type: "select",
				options: [
					{ value: "single", label: { _: this.msg("Single Choice") } },
					{ value: "multiple", label: { _: this.msg("Multiple Choice") } },
				],
				label: { _: this.msg("Mode") },
			},
			"layout": {
				type: "select",
				options: [
					{ value: "list", label: { _: this.msg("List") } },
					{ value: "tiles", label: { _: this.msg("Tiles") } },
				],
				label: { _: this.msg("Layout") },
			},
			randomizeOrder: { type: "boolean", label: { _: this.msg("Randomize Order") } },
			gradingMethod: {
				type: "select",
				options: [
					{ value: "pass-fail", label: { _: this.msg("Pass/Fail") } },
					{ value: "partial", label: { _: this.msg("Partial Credit") } },
				],
				label: { _: this.msg("Grading Method") },
			},
		};
	}

	/** @internal */
	static scopedElements = {
		...WebwriterTask.scopedElements,
		"sl-button": SlButton,
		"draggable-grid": DraggableGrid,
	};

	static styles = [WebwriterTask.styles, css`
		.container-list {
			display: grid;
			grid-template-columns: max-content minmax(0, 1fr) max-content max-content;
		}

		.container-tiles {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(min(130px, 100%), 1fr));
			gap: var(--sl-spacing-medium);
		}

		.add-option {
			margin-block-start: var(--sl-spacing-small);
			max-inline-size: 100%;
			&::part(label) {
				white-space: normal;
			}
		}
	`];

	/**
	 * How many options learners may select.
	 *
	 * - `single`: Exactly one option can be selected.
	 * - `multiple`: Any number of options can be selected.
	 */
	@property({ type: String, attribute: "mode", reflect: true, useDefault: true })
	accessor mode: ChoiceMode = "single";

	/**
	 * How the options are arranged.
	 *
	 * - `list`: One option per row.
	 * - `tiles`: A responsive grid of equally sized tiles.
	 */
	@property({ type: String, attribute: "layout", reflect: true, useDefault: true })
	accessor layout: ChoiceLayout = "list";

	/**
	 * If true, the order of options will be randomized for learners.
	 *
	 * Note: Randomization occurs only during the first render, so changing this property dynamically will not have any effect.
	 */
	@property({ type: Boolean, attribute: "randomize-order", reflect: true, useDefault: true })
	private accessor randomizeOrder: boolean = false;

	/**
	 * How the score of this answer is calculated.
	 *
	 * - `pass-fail`: Full score only if exactly the correct options are selected.
	 * - `partial`: Correct selections earn credit, wrong ones subtract from it.
	 */
	@property({ type: String, attribute: "grading-method", reflect: true, useDefault: true })
	accessor gradingMethod: ChoiceGradingMethod = "pass-fail";

	/**
	 * The options counting as correct, as a map from option ID to whether it has to be selected.
	 * It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: "solution", reflect: true, useDefault: true, converter: encryptedProperty })
	accessor solution: ChoiceSolution = {};

	@state() private accessor currentAnswer: ChoiceSolution = {};
	@state() private accessor graded: boolean = false;
	@state() private accessor detailedFeedback: boolean = false;

	private choices = new QuizItems<WebwriterChoiceItem>(this, "webwriter-choice-item", () => this.randomizeOrder);

	private get selected(): ChoiceSolution {
		return this.editable ? this.solution : this.currentAnswer;
	}

	private set selected(value: ChoiceSolution) {
		if (this.editable) this.solution = value;
		else this.currentAnswer = value;
	}

	private get correctOptions() {
		const correct = this.choices.authored.filter(item => this.solution[item.id]).map(item => item.id);
		return this.mode === "single" ? correct.slice(0, 1) : correct;
	}

	/** @internal */
	getChoiceState(id: string) {
		const expected = this.correctOptions.includes(id);
		const selected = Boolean(this.currentAnswer[id]);
		const graded = this.graded && !this.editable;
		return {
			selected: this.editable ? expected : selected,
			disabled: graded,
			showFeedback: graded && this.detailedFeedback,
			correct: graded && this.detailedFeedback && expected === selected,
		};
	}

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		if (this.editable) encryptPlaintextAttributes(this);
	}

	protected updated(changed: PropertyValues): void {
		super.updated(changed);
		if (changed.has("mode") && this.mode === "single") {
			const first = this.choices.authored.find(item => this.currentAnswer[item.id]);
			if (first) this.currentAnswer = { [first.id]: true };
		}

		if (changed.has("solution") || changed.has("currentAnswer") || changed.has("graded") ||
			changed.has("layout") || changed.has("mode") || changed.has("editable")) {
			this.choices.authored.forEach(item => item.requestUpdate?.());
		}
	}

	private handleReorder({ detail }: DraggableGridReorderEvent) {
		const items = this.choices.authored;
		if (!this.editable || !items.includes(detail.item as WebwriterChoiceItem) ||
			(detail.before && !items.includes(detail.before as WebwriterChoiceItem))) return;
		mutateWithStableSelection(detail.item, () => this.insertBefore(detail.item, detail.before));
	}

	private handleSelect(event: CustomEvent) {
		const item = event.target as WebwriterChoiceItem;
		if (!this.choices.authored.includes(item) || (this.graded && !this.editable)) return;
		if (!item.id && this.editable) item.id = "ww" + crypto.randomUUID();
		const id = item.id;
		if (this.mode === "single") {
			const newSelected = { ...this.selected };
			for (const option of this.choices.authored) newSelected[option.id] = option === item;
			this.selected = newSelected;
		} else {
			this.selected = { ...this.selected, [id]: !this.selected[id] };
		}
	}

	private addOption() {
		if (!this.isConnected || !this.editable) return;
		const item = this.ownerDocument.createElement("webwriter-choice-item");
		item.id = "ww" + crypto.randomUUID();
		item.append(this.ownerDocument.createElement("p"));
		this.appendChild(item);
	}

	checkValidity(): boolean {
		return this.choices.authored.some(item => this.currentAnswer[item.id] === true);
	}

	checkAnswer(detailedFeedback: boolean): number {
		this.graded = true;
		this.detailedFeedback = detailedFeedback;

		const correct = new Set(this.correctOptions);
		const selected = new Set(this.choices.authored.filter(item => this.currentAnswer[item.id]).map(item => item.id));

		const selectedCorrect = selected.intersection(correct);
		const selectedWrong = selected.difference(correct);

		if (this.gradingMethod === "pass-fail") {
			return selectedWrong.size === 0 && selectedCorrect.size === correct.size ? 1 : 0;
		} else if (this.gradingMethod === "partial") {
			return correct.size ? Math.max(0, selectedCorrect.size - selectedWrong.size) / correct.size : 0;
		} else {
			return 0;
		}
	}

	reset() {
		this.currentAnswer = {};
		this.choices.shuffle();
		this.graded = false;
		this.detailedFeedback = false;
	}

	private AddOptionButton() {
		if (!this.editable) return nothing;
		return html`<sl-button class="add-option" @click=${this.addOption}>
			<sl-icon slot="prefix" src=${PlusIcon}></sl-icon>
			${this.msg("Add Option")}
		</sl-button>`;
	}

	protected renderAnswer() {
		return html`<draggable-grid
			class="container-${this.layout}"
			?vertical=${this.layout === "list"}
			@reorder=${this.handleReorder}
		>
			<slot @select=${this.handleSelect}></slot>
		</draggable-grid>
		${this.AddOptionButton()}`;
	}
}
