import { msg } from "@lit/localize";
import HandIndexThumbIcon from "bootstrap-icons/icons/hand-index-thumb.svg";
import { customElement } from "lit/decorators.js";
import { name as packageId } from "../../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../../api";
import { ArtboardContainerElement } from "../../lib/artboard";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-dnd": WebWriterDragAndDrop;
	}
}

registerQuizType({
	packageId,
	widgetPosition: 20,
	id: "webwriter-dnd",
	getName: () => msg("Drag and Drop"),
	icon: HandIndexThumbIcon,
	createInstance: () => document.createElement("webwriter-dnd"),
});

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
