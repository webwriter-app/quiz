import { msg, str } from "@lit/localize";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlTag from "@shoelace-style/shoelace/dist/components/tag/tag.component.js";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import ArrowDownIcon from "bootstrap-icons/icons/arrow-down.svg";
import ArrowUpIcon from "bootstrap-icons/icons/arrow-up.svg";
import WarningIcon from "bootstrap-icons/icons/exclamation-triangle.svg";
import TrashIcon from "bootstrap-icons/icons/trash.svg";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { IWebWriterQuizType } from "../api";
import { commonStyles } from "../lib/utils";
import { mutateWithStableSelection } from "../lib/webwriter-quirks";
import type { WebwriterQuiz } from "./webwriter-quiz";

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
export class WebwriterTask extends LitElementWw {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"points": { type: Number, label: { _: msg("Points") } },
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-icon-button": SlIconButton,
		"sl-icon": SlIcon,
		"sl-tag": SlTag,
	};

	static styles = [
		commonStyles,
		css`
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

				.actions {
					opacity: 0;
					display: flex;
					align-items: center;

					sl-icon-button::part(base) {
						/* Ensures that icon buttons match the 1.5 line height of the header text */
						padding: 0.25em;
					}
				}

				.points {
					font-variant-numeric: tabular-nums;
				}
			}

			:host(:hover) .actions {
				opacity: 1;
			}
		`,
	];

	@property({ type: Number, attribute: "points", reflect: true })
	private accessor points = 1;

	@state() private accessor requiredWarning = false;

	@state() private accessor score: number | undefined;

	@state() private accessor gradable = false;

	private gradabilityUpdate = 0;

	connectedCallback() {
		super.connectedCallback();
		this.updateGradability();
	}

	protected willUpdate(changedProperties: Map<PropertyKey, unknown>) {
		if (changedProperties.has("points") && (!Number.isFinite(this.points) || this.points <= 0)) {
			this.points = 1;
		}
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
		const questionTypes = Array.from(this.children).filter(child => !child.slot);
		this.gradable = questionTypes.some(
			child => typeof (child as Partial<IWebWriterQuizType>).checkAnswer === "function",
		);

		for (const questionType of questionTypes) {
			if (customElements.get(questionType.localName)) continue;
			customElements.whenDefined(questionType.localName).then(() => {
				if (update === this.gradabilityUpdate) this.updateGradability();
			});
		}
	}

	private QuizHeader() {
		const quiz = this.parentElement as WebwriterQuiz | null;
		if (!quiz || quiz.tagName !== "WEBWRITER-QUIZ") return nothing;

		const allTasks = Array.from(quiz.children);
		const index = allTasks.indexOf(this);

		return html`
			<div class=${classMap({ "quiz-header": true })}>
				<div class="title">${msg(str`Question ${index + 1}`)}</div>
				${this.requiredWarning
					? html`<sl-tag variant="danger" class="required-warning">
							<sl-icon src=${WarningIcon}></sl-icon> ${msg("Unanswered")}
						</sl-tag>`
					: nothing}
				<div class="spacer"></div>
				<span class="actions author-only">
					<sl-icon-button
						src=${ArrowUpIcon}
						?disabled=${index === 0}
						@click=${() => mutateWithStableSelection(this, () => allTasks[index - 1].before(this))}
					></sl-icon-button>
					<sl-icon-button
						src=${ArrowDownIcon}
						?disabled=${index === allTasks.length - 1}
						@click=${() => mutateWithStableSelection(this, () => allTasks[index + 1].after(this))}
					></sl-icon-button>
					<sl-icon-button src=${TrashIcon} @click=${() => this.remove()}></sl-icon-button>
				</span>
				${this.gradable ? this.TaskResult(quiz) : nothing}
			</div>
		`;
	}

	private TaskResult(quiz: WebwriterQuiz) {
		if (quiz.hidePoints) {
			if (this.score === undefined) return nothing;
			if (this.score === 0) return html`<sl-tag variant="danger">${msg("Incorrect")}</sl-tag>`;
			if (this.score === this.points) return html`<sl-tag variant="success">${msg("Correct")}</sl-tag>`;
			return html`<sl-tag variant="warning">${msg("Partially correct")}</sl-tag>`;
		}

		return html`<span>
			${this.score !== undefined ? html`${this.formatScore(this.score)} / ` : nothing}
			<span class="points">${this.points}</span>
			${this.points === 1 ? msg("point") : msg("points")}
		</span>`;
	}

	render() {
		return html`${this.QuizHeader()}
			<slot name="prompt"></slot>
			<slot @slotchange=${this.updateGradability}></slot> `;
	}
}
