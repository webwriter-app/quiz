import { msg } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

/**
 * A single item of a `<webwriter-pairing>`.
 *
 * It must be a child of its parent element.
 */
@customElement("webwriter-pairing-item")
export class WebwriterPairing extends LitElementWw {
	static styles = css`
		:host {
			display: block;
			aspect-ratio: 1 / 1;
			width: 100%;
			overflow: hidden;
			box-sizing: border-box;
		}

		slot {
			display: grid;
			align-items: center;
			text-align: center;
			height: 100%;

			padding: var(--sl-spacing-x-small);
			box-sizing: border-box;
		}

		::slotted(p) {
			min-width: 0;
			overflow-wrap: anywhere;
		}
	`;

	render() {
		return html`<slot
			style=${styleMap({
				"--ww-placeholder": `"${msg("Item")}"`,
			})}
		></slot>`;
	}
}
