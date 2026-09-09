import { msg } from "@lit/localize";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { action, LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import PlusIcon from "bootstrap-icons/icons/plus.svg";
import UiChecksIcon from "bootstrap-icons/icons/ui-checks.svg";
import UiRadiosIcon from "bootstrap-icons/icons/ui-radios.svg";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, queryAssignedElements, state } from "lit/decorators.js";
import { name as packageId } from "../../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../../api";
import { DraggableGrid, DraggableGridReorderEvent } from "../../lib/draggable-grid";
import { encryptedProperty, encryptPlaintextAttributes } from "../../lib/encrypted-property";
import { randomizeArray } from "../../lib/utils";
import { mutateWithStableSelection, registerAsEnterCreatesNew } from "../../lib/webwriter-quirks";
import type { WebwriterChoiceItem } from "./webwriter-choice-item";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-choice": WebwriterChoice;
	}
}

export type ChoiceMode = "single" | "multiple";
export type ChoiceLayout = "list" | "tiles";
export type ChoiceGradingMethod = "pass-fail" | "partial";
export type ChoiceSolution = { [id: string]: boolean };

registerQuizType({
	packageId,
	widgetPosition: 2,
	id: "webwriter-single-choice",
	getName: () => msg("Single Choice"),
	icon: UiRadiosIcon,
	createInstance: () => {
		const choice = document.createElement("webwriter-choice");
		choice.setAttribute("mode", "single");
		return choice;
	},
});

registerQuizType({
	packageId,
	widgetPosition: 3,
	id: "webwriter-multiple-choice",
	getName: () => msg("Multiple Choice"),
	icon: UiChecksIcon,
	createInstance: () => {
		const choice = document.createElement("webwriter-choice");
		choice.setAttribute("mode", "multiple");
		return choice;
	},
});

/**
 * An answer where learners pick one or more options.
 *
 * The options must be `<webwriter-choice-item>` elements assigned to the
 * default slot.
 */
@customElement("webwriter-choice")
export class WebwriterChoice extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"mode": {
				type: "select",
				options: [
					{ value: "single", label: { _: msg("Single Choice") } },
					{ value: "multiple", label: { _: msg("Multiple Choice") } },
				],
				label: { _: msg("Mode") },
			},
			"layout": {
				type: "select",
				options: [
					{ value: "list", label: { _: msg("List") } },
					{ value: "tiles", label: { _: msg("Tiles") } },
				],
				label: { _: msg("Layout") },
			},
			"randomize-order": { type: "boolean", label: { _: msg("Randomize Order") } },
			"grading-method": {
				type: "select",
				options: [
					{ value: "pass-fail", label: { _: msg("Pass/Fail") } },
					{ value: "partial", label: { _: msg("Partial Credit") } },
				],
				label: { _: msg("Grading Method") },
			},
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-icon": SlIcon,
		"draggable-grid": DraggableGrid,
	};

	static styles = css`
		.container-list {
			display: grid;
			grid-template-columns: max-content minmax(0, 1fr) max-content max-content;
		}

		.container-tiles {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
			gap: var(--sl-spacing-medium);

			.add-option {
				aspect-ratio: 1 / 1;

				border: 1px dashed var(--sl-color-neutral-300);
				border-radius: var(--sl-border-radius-medium);
				box-sizing: border-box;
				color: var(--sl-color-neutral-500);
				cursor: pointer;

				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;

				&:hover {
					background-color: var(--sl-color-primary-50);
					border-color: var(--sl-color-primary-300);
					color: var(--sl-color-primary-700);
				}
			}
		}
	`;

	/**
	 * How many options learners may select.
	 *
	 * - `single`: Exactly one option can be selected.
	 * - `multiple`: Any number of options can be selected.
	 */
	@property({ type: String, attribute: "mode", reflect: true })
	accessor mode: ChoiceMode = "single";

	/**
	 * How the options are arranged.
	 *
	 * - `list`: One option per row.
	 * - `tiles`: A responsive grid of equally sized tiles.
	 */
	@property({ type: String, attribute: "layout", reflect: true })
	accessor layout: ChoiceLayout = "list";

	/**
	 * If true, the order of options will be randomized for learners.
	 *
	 * Note: Randomization occurs only during the first render, so changing this property dynamically will not have any effect.
	 */
	@property({ type: Boolean, attribute: "randomize-order", reflect: true })
	private accessor randomizeOrder: boolean = false;

	/**
	 * How the score of this answer is calculated.
	 *
	 * - `pass-fail`: Full score only if exactly the correct options are selected.
	 * - `partial`: Correct selections earn credit, wrong ones subtract from it.
	 */
	@property({ type: String, attribute: "grading-method", reflect: true })
	accessor gradingMethod: ChoiceGradingMethod = "pass-fail";

	/**
	 * The options counting as correct, as a map from option ID to whether it has to be selected.
	 * It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: "solution", reflect: true, converter: encryptedProperty })
	accessor solution: ChoiceSolution = {};

	@state() private accessor currentAnswer: ChoiceSolution = {};
	@state() private accessor graded: boolean = false;
	@state() private accessor detailedFeedback: boolean = false;

	@queryAssignedElements()
	private accessor items!: WebwriterChoiceItem[];

	private syncSolutionWithItems() {
		const newSolution: ChoiceSolution = {};
		for (const item of this.items) newSolution[item.id] = this.solution[item.id] || false;
		this.solution = newSolution;
	}

	private randomizeItems() {
		this.append(...randomizeArray(this.items));
	}

	private get selected(): ChoiceSolution {
		return this.isContentEditable ? this.solution : this.currentAnswer;
	}

	private set selected(value: ChoiceSolution) {
		if (this.isContentEditable) this.solution = value;
		else this.currentAnswer = value;
	}

	/** @internal */
	getChoiceState(id: string) {
		const correct = this.solution[id] === (this.currentAnswer[id] ?? false);
		return {
			selected: this.selected[id] ?? false,
			disabled: this.graded,
			showFeedback: this.graded && this.detailedFeedback,
			correct: this.graded && this.detailedFeedback && correct,
		};
	}

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		encryptPlaintextAttributes(this);
		this.syncSolutionWithItems();
		// We assume randomizeOrder does not change during learner view, so shuffle only once.
		// TODO: Actually handle dynamic changes to randomizeOrder
		if (this.randomizeOrder && !this.isContentEditable) this.randomizeItems();
	}

	protected updated(changed: PropertyValues): void {
		if (changed.has("mode") && this.mode === "single") {
			// Ensure that the first item is selected if multiple were selected before switching to single mode
			const newSelected: ChoiceSolution = {};
			let isFirst = true;
			for (const item of this.items) {
				if (this.selected[item.id] && isFirst) {
					newSelected[item.id] = true;
					isFirst = false;
				} else {
					newSelected[item.id] = false;
				}
			}
			this.selected = newSelected;
		}

		if (changed.has("solution") || changed.has("currentAnswer") || changed.has("graded")) {
			this.items.forEach(item => item.requestUpdate?.());
		}
	}

	private handleReorder({ detail }: DraggableGridReorderEvent) {
		mutateWithStableSelection(detail.item, () => this.insertBefore(detail.item, detail.before));
	}

	private handleSelect(event: CustomEvent) {
		if (this.graded) return;
		const id = (event.target as WebwriterChoiceItem).id;
		if (this.mode === "single") {
			const newSelected: { [key: string]: boolean } = {};
			for (const key in this.selected) newSelected[key] = key === id;
			this.selected = newSelected;
		} else {
			this.selected = { ...this.selected, [id]: !this.selected[id] };
		}
	}

	connectedCallback() {
		super.connectedCallback();
		registerAsEnterCreatesNew("webwriter-choice-item");
	}

	@action({ label: { _: msg("Add Option") } })
	private addOption() {
		this.appendChild(document.createElement("webwriter-choice-item"));
	}

	checkValidity(): boolean {
		return Object.values(this.currentAnswer).some(v => v === true);
	}

	checkAnswer(detailedFeedback: boolean): number {
		this.graded = true;
		this.detailedFeedback = detailedFeedback;

		const toSet = (map: ChoiceSolution) =>
			new Set(
				Object.entries(map)
					.filter(([, correct]) => correct)
					.map(([id]) => id),
			);

		const correct = toSet(this.solution);
		const selected = toSet(this.selected);

		const selectedCorrect = selected.intersection(correct);
		const selectedWrong = selected.difference(correct);

		if (this.gradingMethod === "pass-fail") {
			return selectedWrong.size === 0 && selectedCorrect.size === correct.size ? 1 : 0;
		} else if (this.gradingMethod === "partial") {
			return Math.max(0, selectedCorrect.size - selectedWrong.size) / correct.size;
		} else {
			return 0;
		}
	}

	reset() {
		const newSelected: ChoiceSolution = {};
		for (const item of this.items) newSelected[item.id] = false;
		this.selected = newSelected;

		if (this.randomizeOrder && !this.isContentEditable) this.randomizeItems();
		this.graded = false;
		this.detailedFeedback = false;
	}

	private AddOptionButton() {
		if (this.layout !== "tiles" || !this.isContentEditable) return nothing;
		return html`
			<div class="add-option" @click=${this.addOption} id="add-option" data-not-draggable>
				<sl-icon src=${PlusIcon}></sl-icon>
				Add Option
			</div>
		`;
	}

	render() {
		return html`<draggable-grid
			class="container-${this.layout}"
			?vertical=${this.layout === "list"}
			@reorder=${this.handleReorder}
		>
			<slot @select=${this.handleSelect} @slotchange=${this.syncSolutionWithItems}></slot>
			${this.AddOptionButton()}
		</draggable-grid>`;
	}
}
