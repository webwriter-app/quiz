import { msg } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import LOCALIZE from "../../localization/generated";
import { HintPopup } from "../lib/hint-popup";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-task-prompt": WebwriterTaskPrompt;
	}
}

/**
 * The question text of a `<webwriter-task>`.
 *
 * It must be assigned to the `prompt` slot of its parent element. An optional
 * `<webwriter-quiz-hint>` may be assigned to its `hint` slot.
 */
@customElement("webwriter-task-prompt")
export class WebwriterTaskPrompt extends LitElementWw {
	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {
		"hint-popup": HintPopup,
	};

	static styles = css`
		:host {
			display: block;
			margin-bottom: var(--sl-spacing-x-small);
		}

		hint-popup {
			float: right;
			/* Ensure that the icon remains clickable at all times */
			position: relative;
			z-index: 10;
		}
	`;

	render() {
		return html`<hint-popup position="start"><slot name="hint"></slot></hint-popup>
			<slot style=${styleMap({ "--ww-placeholder": `"${msg("Prompt")}"` })}></slot>`;
	}
}
