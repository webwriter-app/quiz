import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { QuizElement } from "../lib/localization";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-quiz-feedback": WebwriterQuizFeedback;
	}
}

/** Formatted feedback authored in the feedback slot of a question. */
@customElement("webwriter-quiz-feedback")
export class WebwriterQuizFeedback extends QuizElement {
	static styles = css`
		:host {
			display: block;
		}

		::slotted(p) {
			min-block-size: 1lh;
		}
	`;

	render() {
		return html`<slot style=${styleMap({ "--ww-placeholder": `"${this.msg("Feedback")}"` })}></slot>`;
	}
}
