import { msg } from "@lit/localize";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { LitElementWw } from "@webwriter/lit";
import { registerQuizType, type IWebWriterQuizType } from "../../api";
import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import LOCALIZE from "../../../localization/generated";
import { name as packageId } from "../../../package.json";
import TrueFalseIcon from "../../../assets/icons/truefalse.svg";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-true-false": WebwriterTrueFalse;
	}
}

type TrueFalse = "true" | "false";

registerQuizType({
	packageId,
	widgetPosition: 1,
	id: "webwriter-true-false",
	getName: () => msg("True or False"),
	icon: TrueFalseIcon,
	createInstance: () => document.createElement("webwriter-true-false"),
})

/**
 * An answer where learners decide whether a statement is true or false.
 *
 * It must be assigned to the default slot of a `<webwriter-task>`.
 */
@customElement("webwriter-true-false")
export class WebwriterTrueFalse extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {
		"sl-button": SlButton,
		"sl-button-group": SlButtonGroup,
	};

	static styles = css`
		sl-button:disabled::part(base) {
			opacity: 1 !important;
			cursor: default !important;
		}
	`;

	/**
	 * The value counting as correct.
	 *
	 * - `true`: The statement is true.
	 * - `false`: The statement is false.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor solution: TrueFalse = "true";

	@state() private accessor currentAnswer: TrueFalse | undefined;
	@state() private accessor graded: boolean = false;
	@state() private accessor showFeedback: boolean = false;

	checkValidity() {
		return this.currentAnswer !== undefined;
	}

	reset() {
		this.graded = false;
		this.currentAnswer = undefined;
	}

	checkAnswer(detailedFeedback: boolean) {
		this.graded = true;
		this.showFeedback = detailedFeedback;
		return this.currentAnswer === this.solution ? 1 : 0;
	}

	private get selected() {
		return this.isContentEditable ? this.solution : this.currentAnswer;
	}

	private set selected(value: TrueFalse | undefined) {
		if (this.isContentEditable) this.solution = value ?? "true";
		else this.currentAnswer = value;
	}

	private Button(choice: TrueFalse, label: string) {
		let variant = "default";
		if (this.selected === choice) {
			if (this.graded && this.showFeedback) {
				variant = this.solution === choice ? "success" : "danger";
			} else {
				variant = "primary";
			}
		}

		return html`<sl-button
			variant=${variant}
			@click=${() => (this.selected = choice)}
			?disabled=${this.graded}
		>
			${label}
		</sl-button>`;
	}

	render() {
		return html`<sl-button-group>
			${this.Button("true", msg("True"))} ${this.Button("false", msg("False"))}
		</sl-button-group>`;
	}
}
