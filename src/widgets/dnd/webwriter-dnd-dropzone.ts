import { customElement } from "lit/decorators.js";
import { ArtboardItemElement } from "../../lib/artboard";

@customElement("webwriter-dnd-dropzone")
export class WebWriterDragAndDropDropzone extends ArtboardItemElement {
	hasEditableContent = false;
	minimumWidth = 5;
	minimumHeight = 5;
}
