import { str } from "@lit/localize";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlTag from "@shoelace-style/shoelace/dist/components/tag/tag.component.js";
import type { ActionDeclaration, OptionDeclaration } from "@webwriter/lit";
import WarningIcon from "bootstrap-icons/icons/exclamation-triangle.svg";
import { css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { isQuizTask, type QuizTaskElement } from "../api/index.js";
import { HintPopup } from "../lib/hint-popup";
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
			feedback: { type: "string", multiline: true, label: { _: this.msg("Feedback") } },
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
		"sl-icon": SlIcon,
		"sl-tag": SlTag,
	};

	static styles: CSSResultGroup = css`
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
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}
	`;

	/** The maximum score for this question. */
	@property({ type: Number, attribute: "points", reflect: true, useDefault: true })
	accessor points = 1;

	/** Feedback shown after a successful quiz submission. */
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
			for (const slot of this.renderRoot.querySelectorAll<HTMLSlotElement>('slot[name="prompt"], slot[name="hint"]')) {
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
			${!this.editable && this.submitted && this.feedback.trim()
				? html`<div class="question-feedback" role="status">${this.feedback}</div>`
				: nothing}`;
	}
}

export interface WebwriterTask {
	checkAnswer?(detailedFeedback: boolean): number;
}
