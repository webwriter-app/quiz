import { str } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlDropdown from "@shoelace-style/shoelace/dist/components/dropdown/dropdown.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlTag from "@shoelace-style/shoelace/dist/components/tag/tag.component.js";
import type { ActionDeclaration, OptionDeclaration } from "@webwriter/lit";
import WarningIcon from "bootstrap-icons/icons/exclamation-triangle.svg";
import PlusIcon from "bootstrap-icons/icons/plus.svg";
import { css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { isQuizTask, type QuizTaskElement } from "../api/index.js";
import { HintPopup } from "../lib/hint-popup";
import { questionPickerStyles } from "../lib/question-picker-styles";
import { mutateWithStableSelection } from "../lib/webwriter-quirks";
import type { WebwriterQuiz } from "./webwriter-quiz";
import { QuizElement } from "../lib/localization.js";

/** Base class for a question. Put the prompt in the named slot and implement the answer UI. */
export abstract class WebwriterTask extends QuizElement implements QuizTaskElement {
	abstract checkValidity(): boolean;
	abstract reset(): void;

	/** @internal */
	get options(): Record<string, OptionDeclaration> {
		return {
			points: { type: Number, label: { _: this.msg("Points") } },
		};
	}

	/** @internal */
	get actions(): Record<string, ActionDeclaration & { group?: string; intent?: "default" | "danger" }> {
		if (this.parentElement?.localName !== "webwriter-quiz") return {};
		return {
			moveQuestionUp: { label: { _: this.msg("Move question up") } },
			moveQuestionDown: { label: { _: this.msg("Move question down") } },
			deleteQuestion: { label: { _: this.msg("Delete question") }, intent: "danger" },
		};
	}

	/** @internal */
	static scopedElements: Record<string, CustomElementConstructor> = {
		"hint-popup": HintPopup,
		"sl-button": SlButton,
		"sl-button-group": SlButtonGroup,
		"sl-dropdown": SlDropdown,
		"sl-icon": SlIcon,
		"sl-tag": SlTag,
	};

	static styles: CSSResultGroup = [questionPickerStyles, css`
		:host {
			display: block;
		}

		sl-tag {
			margin-top: -5px;
			margin-bottom: -5px;
		}

		.quiz-header {
			margin-bottom: var(--sl-spacing-3x-small);

			display: flex;
			flex-wrap: wrap;
			align-items: center;

			.title {
				font-weight: bold;
			}

			.required-warning {
				margin-left: var(--sl-spacing-small);

				sl-icon {
					padding-right: var(--sl-spacing-2x-small);
				}
			}

			.spacer {
				flex-grow: 1;
			}

			.points {
				font-variant-numeric: tabular-nums;
			}
		}

		.task-prompt {
			display: flow-root;

			hint-popup {
				float: inline-end;
				position: relative;
				z-index: 10;
			}

			slot[name="prompt"]::slotted(p) {
				margin-block-end: var(--sl-spacing-x-small);
			}
		}

		.question-feedback {
			margin-block-start: var(--sl-spacing-small);
			border-inline-start: 3px solid var(--sl-color-neutral-300);
			padding-inline-start: var(--sl-spacing-small);
			overflow-wrap: anywhere;
		}

		.feedback-label {
			font-weight: bold;
		}

		.legacy-feedback {
			white-space: pre-wrap;
		}

		.authoring-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--sl-spacing-x-small);
			margin-block-start: var(--sl-spacing-small);

			sl-button-group, sl-button {
				min-inline-size: 0;
				max-inline-size: 100%;
			}

			sl-button-group::part(base) {
				max-inline-size: 100%;
			}

			sl-button-group > sl-button::part(base) {
				height: 100%;
			}

			sl-button-group > sl-button::part(label) {
				padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-small);
				line-height: var(--sl-line-height-dense);
				white-space: normal;
				overflow-wrap: anywhere;
			}
		}

		@media print {
			.authoring-row {
				display: none;
			}
		}
	`];

	/** The maximum score for this question. */
	@property({ type: Number, attribute: "points", reflect: true, useDefault: true })
	accessor points = 1;

	/** @deprecated Author a webwriter-quiz-feedback child in the feedback slot. */
	@property({ type: String, reflect: true, useDefault: true })
	accessor feedback = "";

	@state() private accessor requiredWarning = false;

	@state() private accessor score: number | undefined;

	@state() private accessor submitted = false;

	private slotObserver = new MutationObserver(records => {
		if (records.some(record => record.target === this || record.target.parentNode === this)) this.requestUpdate();
	});

	connectedCallback() {
		super.connectedCallback();
		for (const task of this.siblingTasks) task.requestUpdate();
		this.slotObserver.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["slot", "id"] });
		this.requestUpdate();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.slotObserver.disconnect();
	}

	protected updated(changed: PropertyValues) {
		super.updated(changed);
		if (this.shadowRoot?.slotAssignment === "manual") {
			for (const slot of this.renderRoot.querySelectorAll<HTMLSlotElement>('slot[name="prompt"], slot[name="hint"], slot[name="feedback"]')) {
				const children = Array.from(this.children).filter(child => child.slot === slot.name);
				const assigned = slot.assignedElements();
				if (children.length !== assigned.length || children.some((child, index) => child !== assigned[index])) {
					slot.assign(...children);
				}
			}
		}
	}

	protected isAnswerContent(node: Node) {
		while (node.parentNode && node.parentNode !== this) node = node.parentNode;
		return node.parentNode === this && (!(node instanceof Element) || !node.slot);
	}

	/** @internal */
	get hostsQuestionPicker() {
		return true;
	}

	protected get feedbackElement() {
		return this.querySelector(":scope > webwriter-quiz-feedback[slot=feedback]");
	}

	private addFeedback() {
		if (!this.isConnected || !this.editable || this.feedbackElement) return;
		const feedback = this.ownerDocument.createElement("webwriter-quiz-feedback");
		feedback.slot = "feedback";
		for (const line of this.feedback.split(/\r\n?|\n/)) {
			const paragraph = this.ownerDocument.createElement("p");
			paragraph.textContent = line;
			feedback.append(paragraph);
		}
		this.append(feedback);
		this.removeAttribute("feedback");
	}

	/** @internal */
	get maximumPoints() {
		return Number.isFinite(this.points) && this.points > 0 ? this.points : 1;
	}

	/** @internal */
	showRequiredWarning(show: boolean) {
		this.requiredWarning = show;
	}

	/** @internal */
	showScore(score: number | undefined, submitted = score !== undefined) {
		this.score = score;
		this.submitted = submitted;
	}

	/** @internal */
	resetFeedback() {
		this.requiredWarning = false;
		this.showScore(undefined);
	}

	private formatScore(score: number) {
		return Number(score.toFixed(2));
	}

	private get siblingTasks() {
		const quiz = this.parentElement;
		return quiz?.localName === "webwriter-quiz"
			? Array.from(quiz.children).filter(isQuizTask)
			: [];
	}

	private moveQuestionUp() {
		const tasks = this.siblingTasks;
		const previous = tasks[tasks.indexOf(this) - 1];
		if (this.isConnected && this.editable && previous) {
			mutateWithStableSelection(this, () => previous.before(this));
		}
	}

	private moveQuestionDown() {
		const tasks = this.siblingTasks;
		const next = tasks[tasks.indexOf(this) + 1];
		if (this.isConnected && this.editable && next) {
			mutateWithStableSelection(this, () => next.after(this));
		}
	}

	private deleteQuestion() {
		if (this.isConnected && this.editable && this.parentElement?.localName === "webwriter-quiz") this.remove();
	}

	private QuizHeader() {
		const quiz = this.parentElement as WebwriterQuiz | null;
		if (!quiz || quiz.tagName !== "WEBWRITER-QUIZ") return nothing;

		const index = this.siblingTasks.indexOf(this);
		const result = this.checkAnswer ? this.TaskResult(quiz) : nothing;
		const requiredWarning = !quiz.editable && this.requiredWarning;
		if (quiz.hideQuestionTitle && !requiredWarning && result === nothing) return nothing;

		return html`
			<div class="quiz-header">
				${quiz.hideQuestionTitle ? nothing : html`<div class="title">${this.msg(str`Question ${index + 1}`)}</div>`}
				${requiredWarning
					? html`<sl-tag variant="danger" class="required-warning">
							<sl-icon src=${WarningIcon}></sl-icon> ${this.msg("Unanswered")}
						</sl-tag>`
					: nothing}
				<div class="spacer"></div>
				${result}
			</div>
		`;
	}

	private TaskResult(quiz: WebwriterQuiz) {
		const score = quiz.editable ? undefined : this.score;
		if (quiz.hidePoints) {
			if (score === undefined) return nothing;
			if (score === 0) return html`<sl-tag variant="danger">${this.msg("Incorrect")}</sl-tag>`;
			if (score === this.maximumPoints) return html`<sl-tag variant="success">${this.msg("Correct")}</sl-tag>`;
			return html`<sl-tag variant="warning">${this.msg("Partially correct")}</sl-tag>`;
		}

		return html`<span>
			${score !== undefined ? html`${this.formatScore(score)} / ` : nothing}
			<span class="points">${this.maximumPoints}</span>
			${this.maximumPoints === 1 ? this.msg("point") : this.msg("points")}
		</span>`;
	}

	protected abstract renderAnswer(): unknown;

	protected addOption?(): void;

	private AuthoringRow() {
		const addOption = this.addOption;
		const addFeedback = !this.feedbackElement;
		const quiz = this.parentElement as WebwriterQuiz | null;
		const addQuestion = quiz?.renderAddQuestion?.(this) ?? nothing;
		if (!addOption && !addFeedback && addQuestion === nothing) return nothing;

		return html`<div class="authoring-row">
			${addOption || addFeedback ? html`<sl-button-group>
				${addOption ? html`<sl-button class="add-option" @click=${addOption}>
					<sl-icon slot="prefix" src=${PlusIcon}></sl-icon>
					${this.msg("Add Option")}
				</sl-button>` : nothing}
				${addFeedback ? html`<sl-button class="add-feedback" @click=${this.addFeedback}>
					<sl-icon slot="prefix" src=${PlusIcon}></sl-icon>
					${this.msg("Add Feedback")}
				</sl-button>` : nothing}
			</sl-button-group>` : nothing}
			${addQuestion}
		</div>`;
	}

	private QuestionFeedback() {
		const feedback = this.feedbackElement;
		if (this.editable ? !feedback : !this.submitted || (!feedback && !this.feedback.trim())) return nothing;
		return html`<div class="question-feedback">
			<div class="feedback-label">${this.msg("Feedback")}</div>
			${feedback ? html`<slot name="feedback"></slot>`
				: html`<div class="legacy-feedback">${this.feedback}</div>`}
		</div>`;
	}

	render(): TemplateResult {
		const children = Array.from(this.children);
		const showHint = children.some(child => child.slot === "hint") ||
			this.editable && children.some(child => child.slot === "prompt");
		return html`${this.QuizHeader()}
			<div class="task-prompt">
				${showHint ? html`<hint-popup position="start"><slot name="hint"></slot></hint-popup>` : nothing}
				<slot name="prompt" style=${styleMap({ "--ww-placeholder": `"${this.msg("Prompt")}"` })}></slot>
			</div>
			${this.renderAnswer()}
			${this.QuestionFeedback()}
			${this.editable ? this.AuthoringRow() : nothing}`;
	}
}

export interface WebwriterTask {
	checkAnswer?(detailedFeedback: boolean): number;
}
