import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import SlProgressBar from "@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
import type { ActionDeclaration, OptionDeclaration } from "@webwriter/lit";
import { css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { onQuizTypesChanged, type IWebWriterQuizType, type QuizType } from "../api";
import { QuizElement } from "../lib/localization";
import type { WebwriterTask } from "./webwriter-task";

/**
 * A quiz groups multiple `<webwriter-task>` elements into one exercise that is
 * submitted, graded and reset as a whole.
 *
 * The tasks must be assigned to the default slot.
 */
@customElement("webwriter-quiz")
export class WebwriterQuiz extends QuizElement {
	/** @internal */
	get options(): Record<string, OptionDeclaration> {
		return {
			detailedFeedback: { type: "boolean", label: { _: this.msg("Show detailed feedback") } },
			confirmSubmit: { type: "boolean", label: { _: this.msg("Require confirmation before submitting") } },
			confirmReset: { type: "boolean", label: { _: this.msg("Require confirmation before resetting") } },
			hideQuestionTitle: { type: "boolean", label: { _: this.msg("Hide question titles") } },
			hidePoints: { type: "boolean", label: { _: this.msg("Hide points") } },
		};
	}

	/** @internal */
	get actions() {
		const actions: Record<string, ActionDeclaration & { group: string }> = {};
		for (const [name, type] of this.questionActions) {
			actions[name] = { group: "questions", label: { _: type.getName(this.lang) } };
		}
		return actions;
	}

	/** @internal */
	get optionGroups() {
		return { questions: { label: { _: this.msg("Add Question") } } };
	}

	/** @internal */
	static scopedElements = {
		"sl-button": SlButton,
		"sl-dialog": SlDialog,
		"sl-progress-bar": SlProgressBar,
	};

	static styles = css`
		:host {
			display: block;
			container-type: inline-size;
			min-inline-size: 0;
		}

		::slotted(webwriter-task:not(:last-child)) {
			margin-bottom: var(--sl-spacing-2x-large);
		}

		.actions {
			margin-top: 1em;
			display: flex;
			flex-wrap: wrap;
			gap: var(--sl-spacing-small);
			justify-content: space-between;
			align-items: center;
		}

		.total-result {
			display: flex;
			gap: var(--sl-spacing-small);
			align-items: center;
			flex: 1 1 12rem;
			min-inline-size: 0;
			max-inline-size: 24rem;

			sl-progress-bar {
				flex: 1;
			}
		}

		@media print {
			.actions, sl-dialog {
				display: none;
			}
		}
	`;

	/**
	 * Whether learners see per-answer feedback and the solution after submitting.
	 */
	@property({ type: Boolean, attribute: "detailed-feedback", reflect: true, useDefault: true })
	accessor detailedFeedback: boolean = false;

	/**
	 * Whether learners have to confirm a dialog before submitting.
	 */
	@property({ type: Boolean, attribute: "confirm-submit", reflect: true, useDefault: true })
	accessor confirmSubmit: boolean = false;

	/**
	 * Whether learners have to confirm a dialog before resetting.
	 */
	@property({ type: Boolean, attribute: "confirm-reset", reflect: true, useDefault: true })
	accessor confirmReset: boolean = false;

	/** Whether the generated question titles are hidden. */
	@property({ type: Boolean, attribute: "hide-question-title", reflect: true, useDefault: true })
	accessor hideQuestionTitle = false;

	/**
	 * Whether the points of each task and the total score are hidden.
	 */
	@property({ type: Boolean, attribute: "hide-points", reflect: true, useDefault: true })
	accessor hidePoints: boolean = false;

	@state() private accessor totalResult: { score: number; maximum: number } | undefined;

	@state() private accessor confirmationAction: "submit" | "reset" | undefined;

	private unsubscribe?: () => void;

	private questionActions = new Map<string, QuizType>();

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = onQuizTypesChanged(types => {
			const actions = new Map<string, QuizType>();
			for (const type of types) {
				const name = `insertQuestion:${JSON.stringify([type.packageId, type.id])}`;
				if (!Object.hasOwn(this, name)) {
					Object.defineProperty(this, name, { value: () => this.insertQuizType(name) });
				}
				if (!actions.has(name)) actions.set(name, type);
			}
			this.questionActions = actions;
			this.refreshDrawer();
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.questionActions.clear();
	}

	protected updated(changedProperties: PropertyValues) {
		super.updated(changedProperties);
		if (changedProperties.has("editable") && this.editable) this.confirmationAction = undefined;
		if (changedProperties.has("hidePoints") || changedProperties.has("hideQuestionTitle") || changedProperties.has("editable")) {
			this.getTasks().forEach(task => task.requestUpdate?.());
		}
	}

	private insertQuizType(action: string) {
		const quizType = this.questionActions.get(action);
		if (!quizType || !this.isConnected || !this.editable) return;
		const task = this.ownerDocument.createElement("webwriter-task");

		const prompt = this.ownerDocument.createElement("webwriter-task-prompt");
		prompt.slot = "prompt";
		prompt.appendChild(this.ownerDocument.createElement("p"));
		task.appendChild(prompt);
		const quiz = quizType.createInstance();
		task.appendChild(quiz);
		this.appendChild(task);
	}

	private updateTasks() {
		for (const task of this.getTasks()) task.requestUpdate?.();
		this.requestUpdate();
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
			if (answerScore === undefined || !Number.isFinite(answerScore)) continue;

			const points = task.maximumPoints;
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
			label=${isSubmit ? this.msg("Submit answers?") : this.msg("Reset answers?")}
			?open=${this.confirmationAction !== undefined}
			@sl-request-close=${cancel}
			@sl-after-hide=${cancel}
		>
			${isSubmit ? this.msg("Submit your answers for evaluation?") : this.msg("Reset all answers and start over?")}
			<sl-button slot="footer" @click=${cancel}>${this.msg("Cancel")}</sl-button>
			<sl-button slot="footer" variant=${isSubmit ? "primary" : "danger"} @click=${confirm}>
				${isSubmit ? this.msg("Submit") : this.msg("Reset answers")}
			</sl-button>
		</sl-dialog>`;
	}

	render() {
		if (!this.editable) {
			return html`<slot @slotchange=${this.updateTasks}></slot>

				<div class="actions">
					${this.totalResult
						? this.hidePoints ? nothing : html`<div class="total-result">
								<sl-progress-bar .value=${this.getResultPercentage(this.totalResult)}></sl-progress-bar>
								<strong
									>${this.formatScore(this.totalResult.score)} / ${this.formatScore(this.totalResult.maximum)}</strong
								>
							</div>`
						: html`<sl-button
								variant="primary"
								@click=${() => (this.confirmSubmit ? (this.confirmationAction = "submit") : this.submit())}
							>
								${this.msg("Submit")}
							</sl-button>`}
					<sl-button @click=${() => (this.confirmReset ? (this.confirmationAction = "reset") : this.resetAnswers())}>
						${this.msg("Reset answers")}
					</sl-button>
				</div>

				${this.ConfirmationDialog()}`;
		}

		return html`<slot @slotchange=${this.updateTasks}></slot>
			${this.getTasks().length ? nothing : html`<p>${this.msg("Add a question from the Widget drawer.")}</p>`}`;
	}
}
