import { msg } from "@lit/localize";
import { ActionDeclaration, LitElementWw, OptionDeclaration } from "@webwriter/lit";
import InputCursorIcon from "bootstrap-icons/icons/input-cursor.svg";
import { css, html, nothing } from "lit";
import type { WebwriterGapItem } from "./webwriter-gap-item";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import LOCALIZE from "../../../localization/generated";
import { name as packageId } from "../../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../../api";
import { isWebWriter } from "../../lib/webwriter-quirks";
import { randomizeArray } from "../../lib/utils";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-gap": WebwriterGap;
	}
}

export type GapMode = "input" | "drag-and-drop";

registerQuizType({
	packageId,
	widgetPosition: 30,
	id: "webwriter-gap",
	getName: () => msg("Gap"),
	icon: InputCursorIcon,
	createInstance: () => document.createElement("webwriter-gap"),
});

/**
 * An answer where learners fill the gaps in a text.
 *
 * The text must be assigned to the default slot, with a `<webwriter-gap-item>`
 * in place of each gap.
 */
@customElement("webwriter-gap")
export class WebwriterGap extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	get dynamicActions() {
		const options: Record<string, ActionDeclaration> = {
			insertGapAtSelection: { label: { _: msg("Insert gap at selection") } },
		};
		return options;
	}

	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		const options: Record<string, OptionDeclaration> = {
			mode: {
				type: "select",
				label: { _: msg("Mode") },
				options: [
					{ value: "input", label: { _: msg("Freeform input") } },
					{ value: "drag-and-drop", label: { _: msg("Drag and drop") } },
				],
			},
		};
		if (this.mode === "input") {
			options["ignore-case"] = { type: "boolean", label: { _: msg("Ignore case") } };
		}
		return options;
	}

	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {};

	static styles = css`
		:host {
			display: block !important;
		}

		slot {
			display: block;
			cursor: text;
			width: 100%;
		}

		.choices {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5em;
			margin-top: 1em;
			min-height: 2em;
			align-items: flex-start;
		}

		.choice {
			font: inherit;
			color: inherit;
			padding: 0 var(--sl-spacing-x-small);
			height: 2em;
			box-sizing: border-box;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			white-space: nowrap;
			line-height: normal;
			border: 1px solid var(--sl-color-neutral-300);
			border-radius: var(--sl-border-radius-medium);
			background: var(--sl-color-neutral-0);
			position: relative;
			cursor: grab;
			touch-action: none;
			user-select: none;
		}

		/* The chip that follows the pointer during a drag. Styled as a choice, so that the
		   only thing left to set imperatively is its position and size. */
		.choice.ghost {
			position: fixed;
			left: 0;
			top: 0;
			margin: 0;
			z-index: 2147483647;
			pointer-events: none;
			display: none;
			cursor: grabbing;
		}

		::slotted(*) {
			line-height: 2.3;
		}
	`;

	/**
	 * How learners fill the gaps.
	 *
	 * - `input`: Each gap is a text field learners type into.
	 * - `drag-and-drop`: The gaps are filled from a shared pool of draggable answers.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor mode: GapMode = "input";

	/**
	 * Whether answers are compared to the solution case-insensitively. Only applies in `input` mode.
	 */
	@property({ type: Boolean, attribute: "ignore-case", reflect: true })
	accessor ignoreCase = false;

	@state() private accessor graded = false;

	@state()
	private accessor items: WebwriterGapItem[] = [];
	private choices: WebwriterGapItem[] = [];
	private placements = new Map<WebwriterGapItem, WebwriterGapItem>();
	private selected: WebwriterGapItem | null = null;
	private observer = new MutationObserver(() => this.syncItems());
	private drag: {
		choice: WebwriterGapItem;
		pointerId: number;
		x: number;
		y: number;
		offsetX: number;
		offsetY: number;
		ghost: HTMLElement;
		moved: boolean;
	} | null = null;
	private suppressClick = false;

	private syncItems = () => {
		const items = Array.from(this.querySelectorAll<WebwriterGapItem>("webwriter-gap-item"))
			.filter(item => item.closest("webwriter-gap") === this);
		if (items.length === this.items.length && items.every((item, i) => item === this.items[i])) return;

		this.cancelDrag();
		for (const [target, choice] of this.placements) {
			if (!items.includes(target) || !items.includes(choice)) this.placements.delete(target);
		}
		if (this.selected && !items.includes(this.selected)) this.selected = null;
		this.items = items;
		this.choices = randomizeArray(items);
	};

	/** Pushes the state owned by this element onto the items, as part of every update. */
	protected willUpdate() {
		for (const item of this.items) {
			const choice = this.placements.get(item);
			item.mode = this.mode;
			item.graded = this.graded;
			item.answer = choice?.textContent ?? "";
			item.answerSelected = choice !== undefined && choice === this.selected;
		}
	}

	/** Moves `choice` into the gap `target`, or back into the tray of choices for `null`. */
	private place(choice: WebwriterGapItem, target: WebwriterGapItem | null) {
		if (this.graded) return;
		// The gap `choice` currently sits in, or null while it is in the tray.
		const source = Array.from(this.placements).find(([, value]) => value === choice)?.[0] ?? null;
		this.selected = null;
		this.requestUpdate();
		if (source === target) return;

		// A choice already in `target` swaps places with the incoming one, or returns to the tray.
		const displaced = target ? this.placements.get(target) : undefined;
		if (source) this.placements.delete(source);
		if (source && displaced) this.placements.set(source, displaced);
		if (target) this.placements.set(target, choice);
		/**
		 * Dispatched when learners move an answer into or out of a gap. Only in `drag-and-drop` mode.
		 */
		this.dispatchEvent(new Event("change", { bubbles: true }));
	}

	/** @internal */
	activateGap(item: WebwriterGapItem) {
		if (this.graded || this.suppressClick || this.isContentEditable || this.mode !== "drag-and-drop") return;
		if (this.selected) this.place(this.selected, item);
		else {
			this.selected = this.placements.get(item) ?? null;
			this.requestUpdate();
		}
	}

	/** @internal */
	startGapDrag(event: PointerEvent, item: WebwriterGapItem) {
		const choice = this.placements.get(item);
		if (choice) this.startDrag(event, choice);
	}

	private startDrag(event: PointerEvent, choice: WebwriterGapItem) {
		if (this.graded || event.button !== 0 || !event.isPrimary || this.isContentEditable || this.mode !== "drag-and-drop" || this.drag) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const ghost = this.ownerDocument.createElement("div");
		ghost.className = "choice ghost";
		ghost.textContent = choice.textContent;
		ghost.style.width = `${rect.width}px`;
		ghost.style.height = `${rect.height}px`;
		this.renderRoot.querySelector("#drag-layer")?.append(ghost);
		this.drag = { choice, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
			offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, ghost, moved: false };
		window.addEventListener("pointermove", this.moveDrag, { passive: false });
		window.addEventListener("pointerup", this.endDrag);
		window.addEventListener("pointercancel", this.cancelDrag);
		window.addEventListener("blur", this.cancelDrag);
		window.addEventListener("keydown", this.cancelOnEscape);
	}

	/** The gap under the given point, if it belongs to this element. The ghost does not take
	    pointer events, so it never hides the gap underneath it. */
	private targetAt(x: number, y: number) {
		const item = this.ownerDocument.elementFromPoint(x, y)?.closest("webwriter-gap-item");
		return item && this.items.includes(item) ? item : undefined;
	}

	private overTray(x: number, y: number) {
		return !!(this.renderRoot as ShadowRoot).elementFromPoint(x, y)?.closest(".choices");
	}

	private moveDrag = (event: PointerEvent) => {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
		if (!drag.moved) return;
		event.preventDefault();
		drag.ghost.style.display = "flex";
		drag.ghost.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
		const target = this.targetAt(event.clientX, event.clientY);
		for (const item of this.items) item.dropActive = item === target;
	};

	private endDrag = (event: PointerEvent) => {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (drag.moved) {
			this.suppressClick = true;
			setTimeout(() => { this.suppressClick = false; }, 0);
			const target = this.targetAt(event.clientX, event.clientY);
			if (target) this.place(drag.choice, target);
			else if (this.overTray(event.clientX, event.clientY)) this.place(drag.choice, null);
		}
		this.cancelDrag();
	};

	private cancelOnEscape = (event: KeyboardEvent) => {
		if (event.key === "Escape") this.cancelDrag();
	};

	private cancelDrag = () => {
		this.drag?.ghost.remove();
		this.drag = null;
		for (const item of this.items) item.dropActive = false;
		window.removeEventListener("pointermove", this.moveDrag);
		window.removeEventListener("pointerup", this.endDrag);
		window.removeEventListener("pointercancel", this.cancelDrag);
		window.removeEventListener("blur", this.cancelDrag);
		window.removeEventListener("keydown", this.cancelOnEscape);
	};

	private preventProseMirrorLineBreaks = (event: KeyboardEvent) => {
		// Require collapsed selection (i.e. cursor, not text selection)
		const selection = document.getSelection();
		if (!selection || !selection.isCollapsed) return;

		// Require cursor inside a gap item of this gap element
		const parent = selection.focusNode?.parentElement;
		if (!parent || parent.tagName !== "WEBWRITER-GAP-ITEM" || parent.closest("webwriter-gap") !== this) return;

		// Require cursor at the start or end of the gap item
		if (
			(event.key === "ArrowLeft" && selection.focusOffset === 0) ||
			(event.key === "ArrowRight" && selection.focusOffset === selection.focusNode.textContent?.length)
		) {
			// Prevent ProseMirror from inserting a weird line break placeholder/cursor thing
			event.stopPropagation();
		}
	};

	@state()
	private accessor popupPosition: ({ left: string } & ({ top: string } | { bottom: string })) | null = null;

	private getGapSelectionAndRange(): [Selection, Range] | [] {
		const selection = document.getSelection();
		if (!selection) return [];

		// Require non-collapsed selection (i.e. actual text selection, not just a cursor)
		if (selection.rangeCount === 0 || selection.isCollapsed) return [];

		const range = selection.getRangeAt(0);
		const commonNode =
			range.commonAncestorContainer.nodeType === Node.TEXT_NODE
				? range.commonAncestorContainer.parentElement
				: (range.commonAncestorContainer as HTMLElement);
		if (!commonNode) return [];

		// Require selection to be inside this gap element
		if (commonNode.closest("webwriter-gap") !== this) return [];
		// Require selection to not be inside an already existing gap item
		if (commonNode.closest("webwriter-gap-item")) return [];

		return [selection, range];
	}

	private insertGapAtSelection() {
		const [selection, range] = this.getGapSelectionAndRange();
		if (!selection || !range) return;

		const gapItem = document.createElement("webwriter-gap-item");
		let text = range.toString();
		if (text.startsWith(" ")) text = "\u00A0" + text.slice(1);
		gapItem.textContent = text;

		range.deleteContents();
		range.insertNode(gapItem);

		selection.removeAllRanges();
		const afterGapRange = document.createRange();
		afterGapRange.setStartAfter(gapItem);
		afterGapRange.collapse(true);
		selection.addRange(afterGapRange);
		this.popupPosition = null;
	}

	private insertGapOnKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === "G") {
			event.preventDefault();
			this.insertGapAtSelection();
		}
	};

	connectedCallback(): void {
		super.connectedCallback();
		this.observer.observe(this, { childList: true, subtree: true });
		this.syncItems();
		if (this.isContentEditable) {
			if (isWebWriter()) document.addEventListener("keydown", this.preventProseMirrorLineBreaks, true);
			document.addEventListener("keydown", this.insertGapOnKeyDown);
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.observer.disconnect();
		this.cancelDrag();
		if (this.isContentEditable) {
			if (isWebWriter()) document.removeEventListener("keydown", this.preventProseMirrorLineBreaks, true);
			document.removeEventListener("keydown", this.insertGapOnKeyDown);
		}
	}

	checkValidity(): boolean {
		this.syncItems();
		return this.items.every(item => this.mode === "input"
			? item.inputAnswer.trim() !== ""
			: this.placements.has(item));
	}
	reset(): void {
		this.cancelDrag();
		this.choices = randomizeArray(this.items);
		this.placements.clear();
		this.selected = null;
		this.graded = false;
		for (const item of this.items) {
			item.inputAnswer = "";
			item.graded = false;
			item.feedback = null;
		}
		this.requestUpdate();
	}
	checkAnswer(detailedFeedback: boolean): number {
		this.syncItems();
		this.cancelDrag();
		this.selected = null;
		this.graded = true;
		let correctCount = 0;
		for (const item of this.items) {
			const choice = this.placements.get(item);
			const answer = (this.mode === "input" ? item.inputAnswer : choice?.textContent ?? "").trim();
			const solution = (item.textContent ?? "").trim();
			const normalize = (value: string) => this.mode === "input" && this.ignoreCase ? value.toLowerCase() : value;
			const correct = solution !== "" && normalize(answer) === normalize(solution);
			if (correct) correctCount++;
			item.graded = true;
			item.feedback = detailedFeedback ? { correct, answer, solution } : null;
		}
		return this.items.length ? correctCount / this.items.length : 1;
	}

	render() {
		const placed = new Set(this.placements.values());
		return html`<div>
			<!-- Holds the drag ghost, which is placed imperatively and must survive re-renders. -->
			<div id="drag-layer"></div>
			<slot style=${styleMap({ "--ww-placeholder": `"${msg("Text")}"` })} @slotchange=${this.syncItems}></slot>
			${this.mode === "drag-and-drop" && !this.isContentEditable ? html`
				<div class="choices" role="group" aria-label=${msg("Available answers")}>
					${this.choices.filter(item => !placed.has(item)).map(item => html`
						<button class="choice" type="button" ?disabled=${this.graded} aria-pressed=${this.selected === item}
							@pointerdown=${(event: PointerEvent) => this.startDrag(event, item)}
							@click=${() => {
								if (this.suppressClick) return;
								this.selected = this.selected === item ? null : item;
								this.requestUpdate();
							}}>${item.textContent}</button>
					`)}
					${this.selected && placed.has(this.selected) ? html`
						<button type="button" @click=${() => this.place(this.selected!, null)}>${msg("Return to answers")}</button>
					` : nothing}
				</div>
			` : nothing}
		</div>`;
	}
}
