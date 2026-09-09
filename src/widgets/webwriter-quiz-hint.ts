import { msg } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import LOCALIZE from "../../localization/generated";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-quiz-hint": WebwriterQuizHint;
	}
}

/**
 * A generic hint element that can be used inside a variety of elements that
 * explicitly mention it in their documentation, such as `<webwriter-task>`.
 *
 * Unless otherwise specified, it should be assigned to the `hint` slot of its
 * parent element.
 */
@customElement("webwriter-quiz-hint")
export class WebwriterQuizHint extends LitElementWw {
	/** @internal */
	localize = LOCALIZE;

	static styles = css`
		slot {
			display: inline-block !important;
			min-width: 10ch;
		}
	`;

	render() {
		return html`<slot style=${styleMap({ "--ww-placeholder": `"${msg("Hint")}"` })}></slot>`;
	}
}
