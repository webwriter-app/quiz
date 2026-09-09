import { msg } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import SlDropdown from "@shoelace-style/shoelace/dist/components/dropdown/dropdown.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlProgressBar from "@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.component.js";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import AddIcon from "bootstrap-icons/icons/plus-lg.svg";
import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { getQuizTypes, onQuizTypesChanged, type IWebWriterQuizType, type QuizType } from "../api";
import type { WebwriterTask } from "./webwriter-task";

/**
 * A quiz groups multiple `<webwriter-task>` elements into one exercise that is
 * submitted, graded and reset as a whole.
 *
 * The tasks must be assigned to the default slot.
 */
@customElement("webwriter-quiz")
export class WebwriterQuiz extends LitElementWw {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"detailed-feedback": { type: "boolean", label: { _: msg("Show detailed feedback") } },
			"confirm-submit": { type: "boolean", label: { _: msg("Require confirmation before submitting") } },
			"confirm-reset": { type: "boolean", label: { _: msg("Require confirmation before resetting") } },
			"hide-points": { type: "boolean", label: { _: msg("Hide points") } },
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-button": SlButton,
		"sl-dialog": SlDialog,
		"sl-icon": SlIcon,
		"sl-dropdown": SlDropdown,
		"sl-progress-bar": SlProgressBar,
	};

	static styles = css`
		:host {
			container-type: inline-size;
		}

		.header-placeholder {
			font-weight: bold;
			margin-bottom: var(--sl-spacing-x-small);
		}

		::slotted(webwriter-task:not(:last-child)) {
			margin-bottom: var(--sl-spacing-2x-large);
		}

		.insert-task-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: var(--sl-spacing-small);

			sl-button::part(base) {
				justify-content: flex-start;
			}
		}

		.add-question {
			margin-top: var(--sl-spacing-small);

			display: flex;
			justify-content: center;

			sl-dropdown::part(panel) {
				background-color: var(--sl-color-neutral-0);
				/* Ensure that panel follows the rounded corners of the button */
				border-radius: calc(var(--sl-input-border-radius-medium) + var(--sl-spacing-x-small));
			}

			.dropdown-container {
				width: 100cqw;
				box-sizing: border-box;
				padding: var(--sl-spacing-x-small);
			}
		}

		.actions {
			margin-top: 1em;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.total-result {
			display: flex;
			gap: var(--sl-spacing-small);
			align-items: center;

			sl-progress-bar {
				width: 300px;
			}
		}
	`;

	/**
	 * Whether learners see per-answer feedback and the solution after submitting.
	 */
	@property({ type: Boolean, attribute: "detailed-feedback", reflect: true })
	accessor detailedFeedback: boolean = false;

	/**
	 * Whether learners have to confirm a dialog before submitting.
	 */
	@property({ type: Boolean, attribute: "confirm-submit", reflect: true })
	accessor confirmSubmit: boolean = false;

	/**
	 * Whether learners have to confirm a dialog before resetting.
	 */
	@property({ type: Boolean, attribute: "confirm-reset", reflect: true })
	accessor confirmReset: boolean = false;

	/**
	 * Whether the points of each task and the total score are hidden.
	 */
	@property({ type: Boolean, attribute: "hide-points", reflect: true })
	accessor hidePoints: boolean = false;

	@state() private accessor quizTypes: readonly QuizType[] = getQuizTypes();

	@state() private accessor totalResult: { score: number; maximum: number } | undefined;

	@state() private accessor confirmationAction: "submit" | "reset" | undefined;

	private unsubscribe?: () => void;

	private addQuestionDropdownRef = createRef<SlDropdown>();

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = onQuizTypesChanged(types => {
			this.quizTypes = [...types];
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.quizTypes = [];
	}

	protected updated(changedProperties: Map<PropertyKey, unknown>) {
		if (changedProperties.has("hidePoints")) {
			this.getTasks().forEach(task => task.requestUpdate?.());
		}
	}

	private insertQuizType(quizType: QuizType) {
		const task = document.createElement("webwriter-task");

		const prompt = document.createElement("webwriter-task-prompt");
		prompt.appendChild(document.createElement("p"));
		task.appendChild(prompt);
		const quiz = quizType.createInstance();
		task.appendChild(quiz);
		this.appendChild(task);

		this.addQuestionDropdownRef.value?.hide();
		this.requestUpdate();
	}

	private InsertQuestionGrid() {
		return html`<div class="insert-task-grid">
			${this.quizTypes.map(
				quizType =>
					html`<sl-button @click=${() => this.insertQuizType(quizType)}>
						<sl-icon src=${quizType.icon ?? ""} slot="prefix"></sl-icon>
						${quizType.getName()}
					</sl-button>`,
			)}
		</div>`;
	}

	private getTasks() {
		return Array.from(this.children).filter((child): child is WebwriterTask => child.tagName === "WEBWRITER-TASK");
	}

	private getTaskApi(task: WebwriterTask): IWebWriterQuizType | undefined {
		return Array.from(task.children).find(
			(child): child is HTMLElement & IWebWriterQuizType =>
				typeof (child as Partial<IWebWriterQuizType>).checkValidity === "function",
		);
	}

	private getTaskPoints(task: WebwriterTask) {
		const points = Number(task.getAttribute("points") ?? 1);
		return Number.isFinite(points) && points > 0 ? points : 1;
	}

	private formatScore(score: number) {
		return Number(score.toFixed(2));
	}

	private getResultPercentage(result: { score: number; maximum: number }) {
		if (result.maximum <= 0) return 0;
		return (result.score / result.maximum) * 100;
	}

	private resetAnswers() {
		for (const task of this.getTasks()) {
			this.getTaskApi(task)?.reset();
			task.resetFeedback();
		}
		this.totalResult = undefined;
	}

	private submit() {
		const tasksWithApi = this.getTasks().map(task => ({
			task,
			api: this.getTaskApi(task),
		}));
		const validities = tasksWithApi.map(({ task, api }) => {
			const valid = api?.checkValidity() ?? false;
			task.showRequiredWarning(!valid);
			task.showScore(undefined);
			return valid;
		});

		this.totalResult = undefined;
		if (validities.some(valid => !valid)) return;

		let score = 0;
		let maximum = 0;
		for (const { task, api } of tasksWithApi) {
			const answerScore = api?.checkAnswer?.(this.detailedFeedback);
			if (answerScore === undefined) continue;

			const points = this.getTaskPoints(task);
			const taskScore = Math.max(0, Math.min(1, answerScore)) * points;
			task.showScore(taskScore);
			score += taskScore;
			maximum += points;
		}
		this.totalResult = { score, maximum };
	}

	private ConfirmationDialog() {
		const isSubmit = this.confirmationAction === "submit";

		const cancel = () => (this.confirmationAction = undefined);
		const confirm = () => {
			const action = this.confirmationAction;
			this.confirmationAction = undefined;
			if (action === "submit") this.submit();
			else if (action === "reset") this.resetAnswers();
		};

		return html`<sl-dialog
			label=${isSubmit ? msg("Submit answers?") : msg("Reset answers?")}
			?open=${this.confirmationAction !== undefined}
			@sl-request-close=${cancel}
			@sl-after-hide=${cancel}
		>
			${isSubmit ? msg("Submit your answers for evaluation?") : msg("Reset all answers and start over?")}
			<sl-button slot="footer" @click=${cancel}>${msg("Cancel")}</sl-button>
			<sl-button slot="footer" variant=${isSubmit ? "primary" : "danger"} @click=${confirm}>
				${isSubmit ? msg("Submit") : msg("Reset answers")}
			</sl-button>
		</sl-dialog>`;
	}

	render() {
		if (!this.isContentEditable) {
			return html`<slot></slot>

				<div class="actions">
					${this.totalResult
						? html`<div class="total-result">
								<sl-progress-bar .value=${this.getResultPercentage(this.totalResult)}></sl-progress-bar>
								<strong
									>${this.formatScore(this.totalResult.score)} / ${this.formatScore(this.totalResult.maximum)}</strong
								>
							</div>`
						: html`<sl-button
								variant="primary"
								@click=${() => (this.confirmSubmit ? (this.confirmationAction = "submit") : this.submit())}
							>
								${msg("Submit")}
							</sl-button>`}
					<sl-button @click=${() => (this.confirmReset ? (this.confirmationAction = "reset") : this.resetAnswers())}>
						${msg("Reset answers")}
					</sl-button>
				</div>

				${this.ConfirmationDialog()}`;
		}

		if (this.children.length > 0) {
			return html`<slot
					@slotchange=${() => {
						// Update numbering in the quiz header in case the order changed
						Array.from(this.children)
							.filter(c => c.tagName === "WEBWRITER-TASK")
							.forEach(t => (t as WebwriterTask).requestUpdate?.());
						this.requestUpdate();
					}}
				></slot>
				<div class="add-question">
					<sl-dropdown placement="bottom" distance="4" ${ref(this.addQuestionDropdownRef)}>
						<sl-button slot="trigger" caret>
							<sl-icon slot="prefix" src=${AddIcon}></sl-icon>
							${msg("Add Question")}
						</sl-button>
						<div class="dropdown-container">${this.InsertQuestionGrid()}</div>
					</sl-dropdown>
				</div>`;
		} else {
			return html`<div class="header-placeholder">${msg("Question 1")}</div>
				${this.InsertQuestionGrid()}`;
		}
	}
}
