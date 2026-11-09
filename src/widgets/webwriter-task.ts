import { str } from "@lit/localize";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlTag from "@shoelace-style/shoelace/dist/components/tag/tag.component.js";
import { type OptionDeclaration } from "@webwriter/lit";
import WarningIcon from "bootstrap-icons/icons/exclamation-triangle.svg";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { IWebWriterQuizType } from "../api";
import { mutateWithStableSelection } from "../lib/webwriter-quirks";
import type { WebwriterQuiz } from "./webwriter-quiz";
import { QuizElement } from "../lib/localization";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-task": WebwriterTask;
	}
}

/**
 * A task describes a single quiz question, which consists of a
 * `<webwriter-task-prompt>`, an optional `<webwriter-quiz-hint>` and an answer
 * of a certain type, such as `<webwriter-choice>`.
 *
 * The `<webwriter-task-prompt>` must be assigned to the `prompt` slot, the
 * `<webwriter-quiz-hint>` must be assigned to the `hint` slot and the answer
 * must be assigned to the default slot.
 */
@customElement("webwriter-task")
export class WebwriterTask extends QuizElement {
	/** @internal */
	get options(): Record<string, OptionDeclaration> {
		return {
			points: { type: Number, label: { _: this.msg("Points") } },
		};
	}

	/** @internal */
	get actions() {
		if (this.parentElement?.localName !== "webwriter-quiz") return {};
		return {
			moveQuestionUp: { label: { _: this.msg("Move question up") } },
			moveQuestionDown: { label: { _: this.msg("Move question down") } },
			deleteQuestion: { label: { _: this.msg("Delete question") }, intent: "danger" as const },
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-icon": SlIcon,
		"sl-tag": SlTag,
	};

	static styles = css`
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
	`;

	@property({ type: Number, attribute: "points", reflect: true, useDefault: true })
	private accessor points = 1;

	@state() private accessor requiredWarning = false;

	@state() private accessor score: number | undefined;

	@state() private accessor gradable = false;

	private gradabilityUpdate = 0;

	connectedCallback() {
		super.connectedCallback();
		this.updateGradability();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.gradabilityUpdate++;
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
	showScore(score: number | undefined) {
		this.score = score;
	}

	/** @internal */
	resetFeedback() {
		this.requiredWarning = false;
		this.score = undefined;
	}

	private formatScore(score: number) {
		return Number(score.toFixed(2));
	}

	private updateGradability() {
		const update = ++this.gradabilityUpdate;
		if (!this.isConnected) return;
		const questionTypes = Array.from(this.children).filter(child => !child.slot);
		this.gradable = questionTypes.some(
			child => typeof (child as Partial<IWebWriterQuizType>).checkAnswer === "function",
		);

		const registry = this.ownerDocument.defaultView?.customElements;
		for (const questionType of questionTypes) {
			if (!registry || !questionType.localName.includes("-") || registry.get(questionType.localName)) continue;
			registry.whenDefined(questionType.localName).then(() => {
				if (update === this.gradabilityUpdate) this.updateGradability();
			});
		}
	}

	private get siblingTasks() {
		const quiz = this.parentElement;
		return quiz?.localName === "webwriter-quiz"
			? Array.from(quiz.children).filter(child => child.localName === this.localName)
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
		const result = this.gradable ? this.TaskResult(quiz) : nothing;
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

	render() {
		return html`${this.QuizHeader()}
			<slot name="prompt"></slot>
			<slot @slotchange=${this.updateGradability}></slot> `;
	}
}
