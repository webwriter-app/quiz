import { msg } from "@lit/localize";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlTextarea from "@shoelace-style/shoelace/dist/components/textarea/textarea.component.js";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import TextParagraphIcon from "bootstrap-icons/icons/text-paragraph.svg";
import { css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import LOCALIZE from "../../localization/generated";
import { name as packageId } from "../../package.json";
import { registerQuizType, type IWebWriterQuizType } from "../api";
import { encryptedProperty, encryptPlaintextAttributes } from "../lib/encrypted-property";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-text": WebwriterText;
	}
}

export type TextType = "long-text" | "text" | "number" | "date" | "time" | "datetime-local";

registerQuizType({
	packageId,
	widgetPosition: 30,
	id: "webwriter-text",
	getName: () => msg("Text"),
	icon: TextParagraphIcon,
	createInstance: () => document.createElement("webwriter-text"),
});

/**
 * An answer where learners type a value into an input field.
 *
 * It must be assigned to the default slot of a `<webwriter-task>`.
 */
@customElement("webwriter-text")
export class WebwriterText extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {
		"sl-textarea": SlTextarea,
		"sl-input": SlInput,
	};

	static styles = css`
		:host {
			display: block;
			width: 100%;
		}

		/* Highlight the author's solution while editing. */
		:host(:is([contenteditable="true"], [contenteditable=""])) :is(sl-textarea::part(textarea), sl-input::part(input)) {
			color: var(--sl-color-success-700);
		}

		sl-textarea::part(base),
		sl-input::part(base) {
			font-size: 1em !important;
		}

		sl-textarea {
			resize: vertical;
			overflow: hidden;
			min-height: 40px;

			&::part(form-control),
			&::part(form-control-input),
			&::part(base),
			&::part(textarea) {
				height: 100%;
			}
		}

		:is(sl-textarea, sl-input):disabled::part(base) {
			background-color: var(--sl-input-background-color);
			border-color: var(--sl-input-border-color);
			opacity: 1;
			cursor: inherit;
		}

		:is(sl-textarea, sl-input)[data-state="correct"]::part(base) {
			background: var(--sl-color-success-50);
			border-color: var(--sl-color-success-400);
		}

		:is(sl-textarea, sl-input)[data-state="incorrect"]::part(base) {
			background: var(--sl-color-danger-50);
			border-color: var(--sl-color-danger-400);
		}

		.feedback {
			margin-top: var(--sl-spacing-x-small);
			color: var(--sl-color-neutral-500);
			font-size: var(--sl-font-size-small);
			overflow-wrap: anywhere;
		}

		.solution {
			margin-top: var(--sl-spacing-x-small);
		}
	`;

	/**
	 * The kind of input field learners answer in.
	 *
	 * - `long-text`: A multi-line text area.
	 * - `text`: A single-line text field.
	 * - `number`: A number field.
	 * - `date`: A date picker.
	 * - `time`: A time picker.
	 * - `datetime-local`: A combined date and time picker.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor type: TextType = "long-text";

	/**
	 * The placeholder shown while the field is empty.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor placeholder: string = "";

	/**
	 * Whether any non-empty answer counts as correct, without comparing it to the solution.
	 */
	@property({ type: Boolean, attribute: "free-text", reflect: true })
	accessor freeText = false;

	/**
	 * Whether the answer is compared to the solution case-insensitively.
	 */
	@property({ type: Boolean, attribute: "ignore-case", reflect: true })
	accessor ignoreCase = false;

	/**
	 * The feedback shown after submitting if the answer is correct.
	 */
	@property({ type: String, attribute: "correct-message", reflect: true })
	accessor correctMessage: string = "";

	/**
	 * The feedback shown after submitting if the answer is wrong.
	 */
	@property({ type: String, attribute: "wrong-message", reflect: true })
	accessor wrongMessage: string = "";

	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		const isText = this.type === "long-text" || this.type === "text";
		const options: Record<string, OptionDeclaration> = {
			type: {
				type: "select",
				label: { _: msg("Type") },
				options: [
					{ value: "long-text", label: { _: msg("Long Text") } },
					{ value: "text", label: { _: msg("Short Text") } },
					{ value: "number", label: { _: msg("Number") } },
					{ value: "date", label: { _: msg("Date") } },
					{ value: "time", label: { _: msg("Time") } },
					{ value: "datetime-local", label: { _: msg("Date & Time") } },
				],
			},
		};

		if (isText || this.type === "number") {
			options.placeholder = { type: "string", label: { _: msg("Placeholder") } };
		}

		options["free-text"] = { type: "boolean", label: { _: msg("Free answer") } };

		if (!this.freeText) {
			if (isText) {
				options["ignore-case"] = {
					type: "boolean",
					label: { _: msg("Ignore capitalization") },
				};
			}
			options["correct-message"] = {
				type: "string",
				label: { _: msg("Message for correct solution") },
			};
			options["wrong-message"] = {
				type: "string",
				label: { _: msg("Message for wrong solution") },
			};
		}

		return options;
	}

	/**
	 * The value counting as correct. It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: String, attribute: true, reflect: true, converter: encryptedProperty })
	accessor solution: string = "";

	@state() private accessor currentAnswer: string | undefined;
	@state() private accessor graded: boolean = false;
	@state() private accessor detailedFeedback: boolean = false;

	@query("sl-textarea, sl-input")
	private accessor input!: SlTextarea | SlInput;

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		encryptPlaintextAttributes(this);
	}

	private get value(): string {
		return this.isContentEditable ? this.solution : (this.currentAnswer ?? "");
	}

	private set value(value: string) {
		if (this.isContentEditable) this.solution = value;
		else this.currentAnswer = value;
	}

	private isCorrect(): boolean {
		const answer = (this.currentAnswer ?? "").trim();
		if (this.freeText) return answer !== "";
		const solution = this.solution.trim();
		if (!solution) return false;
		return this.ignoreCase ? answer.toLowerCase() === solution.toLowerCase() : answer === solution;
	}

	override focus() {
		this.input?.focus();
	}

	checkValidity(): boolean {
		return (this.currentAnswer ?? "").trim() !== "";
	}

	reset() {
		this.graded = false;
		this.detailedFeedback = false;
		this.currentAnswer = undefined;
	}

	checkAnswer(detailedFeedback: boolean): number {
		this.graded = true;
		this.detailedFeedback = detailedFeedback;
		return this.isCorrect() ? 1 : 0;
	}

	private handleChange = (e: Event) => {
		const target = e.target as SlTextarea | SlInput;
		this.value = target.value?.trim() ?? "";
	};

	private get feedbackState(): "correct" | "incorrect" | undefined {
		// Free answers are locked on submit but never marked correct/incorrect.
		if (this.freeText || this.isContentEditable || !this.graded || !this.detailedFeedback) return undefined;
		return this.isCorrect() ? "correct" : "incorrect";
	}

	render() {
		const value = this.value;
		const state = this.feedbackState;
		const message = state === "correct" ? this.correctMessage : this.wrongMessage;
		const showSolution = this.detailedFeedback && this.solution.trim() !== "";

		const field =
			this.type === "long-text"
				? html`<sl-textarea
						data-state=${state ?? nothing}
						value=${value}
						placeholder=${this.placeholder}
						resize="none"
						?disabled=${this.graded}
						@sl-change=${this.handleChange}
					></sl-textarea>`
				: html`<sl-input
						data-state=${state ?? nothing}
						value=${value}
						placeholder=${this.placeholder}
						type=${this.type}
						?disabled=${this.graded}
						@sl-change=${this.handleChange}
					></sl-input>`;

		return html`${field}${state && (message || showSolution)
			? html`<div class="feedback" data-state=${state} role="status">
					${message ? html`<div>${message}</div>` : nothing}
					${showSolution
						? html`<div class="solution"><strong>${msg("Solution")}:</strong> ${this.solution}</div>`
						: nothing}
				</div>`
			: nothing}`;
	}
}
