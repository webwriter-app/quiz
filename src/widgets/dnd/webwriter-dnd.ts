import { customElement } from "lit/decorators.js";
import type { IWebWriterQuizType } from "../../api";
import { ArtboardContainerElement } from "../../lib/artboard";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-dnd": WebWriterDragAndDrop;
	}
}

@customElement("webwriter-dnd")
export class WebWriterDragAndDrop extends ArtboardContainerElement implements IWebWriterQuizType {
	protected readonly itemElementTags = ["webwriter-dnd-draggable", "webwriter-dnd-dropzone"];

	checkValidity(): boolean {
		throw new Error("Method not implemented.");
	}
	reset(): void {
		throw new Error("Method not implemented.");
	}
	checkAnswer?(detailedFeedback: boolean): number {
		throw new Error("Method not implemented.");
	}
}
