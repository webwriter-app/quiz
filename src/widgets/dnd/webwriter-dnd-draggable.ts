import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { ArtboardItemElement } from "../../lib/artboard";

@customElement("webwriter-dnd-draggable")
export class WebWriterDragAndDropDraggable extends ArtboardItemElement {
	hasEditableContent = true;
	minimumWidth = 5;
	minimumHeight = 5;

	static styles = css`
		:host {
			background-color: var(--sl-color-neutral-0);
			border-radius: var(--sl-border-radius-medium);
			width: 100%;
			height: 100%;
			display: block;
			box-sizing: border-box;
			padding: 5px var(--sl-spacing-x-small);
			border: 1px solid var(--sl-color-neutral-300);
			overflow: hidden;
		}
	`;

	render() {
		return html`<slot></slot>`;
	}
}
