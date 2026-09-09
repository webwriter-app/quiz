import { msg } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { ActionDeclaration, LitElementWw, OptionDeclaration } from "@webwriter/lit";
import { css, html, nothing, PropertyValues } from "lit";
import { property, queryAll } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";

type Geometry = { x: number; y: number; width: number; height: number };
type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const CLICK_SLOP = 4;
const RESIZE_DIRECTIONS: ResizeDirection[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export abstract class ArtboardContainerElement extends LitElementWw {
	static shadowRootOptions: ShadowRootInit = {
		...LitElementWw.shadowRootOptions,
		slotAssignment: "manual",
	};

	static scopedElements = {
		"sl-button": SlButton,
	};

	static styles = css`
		.artboard-container {
			border: 1px solid var(--sl-color-neutral-300);
			box-sizing: border-box;
			width: 100%;
			border-radius: var(--sl-border-radius-medium);
			overflow: hidden;
		}

		.file-input {
			display: none;
		}

		header {
			padding: var(--sl-spacing-x-small);
			border-bottom: 1px solid var(--sl-color-neutral-300);
		}

		.background-chooser {
			background-color: var(--sl-color-neutral-100);
			aspect-ratio: 16 / 9;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.background {
			display: block;
			width: 100%;
			pointer-events: none;
		}

		.artboard {
			container-type: inline-size;
			position: relative;
			touch-action: none;
			overflow: hidden;
		}

		.overlay {
			position: absolute;
			z-index: 100;
			inset: 0;
		}

		.item {
			position: absolute;
		}

		.item.editing {
			z-index: 101;
		}

		.marquee,
		.selection-box {
			position: absolute;
			box-sizing: border-box;
			border: var(--sl-input-border-width) solid var(--sl-color-primary-600);
			pointer-events: none;
		}

		.marquee {
			z-index: 200;
			background: color-mix(in srgb, var(--sl-color-primary-600) 12%, transparent);
		}

		.selection-box {
			z-index: 201;
		}

		.handle {
			position: absolute;
			width: 8px;
			height: 8px;
			box-sizing: border-box;
			background: var(--sl-color-neutral-0);
			border: var(--sl-input-border-width) solid var(--sl-color-primary-600);
			pointer-events: auto;
		}

		/* prettier-ignore */
		.handle {
      &[data-direction="nw"] { left: -5px; top: -5px; cursor: nwse-resize; }
      &[data-direction="n" ] { left: calc(50% - 4px); top: -5px; cursor: ns-resize; }
      &[data-direction="ne"] { right: -5px; top: -5px; cursor: nesw-resize; }
      &[data-direction="e" ] { right: -5px; top: calc(50% - 4px); cursor: ew-resize; }
      &[data-direction="se"] { right: -5px; bottom: -5px; cursor: nwse-resize; }
      &[data-direction="s" ] { left: calc(50% - 4px); bottom: -5px; cursor: ns-resize; }
      &[data-direction="sw"] { left: -5px; bottom: -5px; cursor: nesw-resize; }
      &[data-direction="w" ] { left: -5px; top: calc(50% - 4px); cursor: ew-resize; }
    }
	`;

	private imageInputRef = createRef<HTMLInputElement>();

	@property({ type: String, attribute: true, reflect: true })
	accessor backgroundSrc: string | null = null;

	@property({ type: Boolean, attribute: "snap-to-grid", reflect: true })
	accessor snapToGrid = false;

	@property({ type: Number, attribute: "grid-columns", reflect: true })
	accessor gridColumns = 100;

	get dynamicOptions() {
		const options: Record<string, OptionDeclaration> = {
			"snap-to-grid": { type: "boolean", label: { _: msg("Snap to grid") } },
		};
		if (this.snapToGrid) {
			options["grid-columns"] = { type: "number", label: { _: msg("Grid columns") }, min: 1, step: 1 };
		}
		return options;
	}

	protected abstract readonly itemElementTags: readonly string[];

	private containerRef = createRef<HTMLDivElement>();
	private items: ArtboardItemElement[] = [];
	private itemObserver = new MutationObserver(() => this.updateItems());

	private selection = new Set<string>();
	private editingId: string | null = null;
	private preview = new Map<string, Geometry>();
	private marquee: Geometry | null = null;
	private stopGesture: (() => void) | null = null;

	private async updateItems() {
		// Wait until every supported child has been registered, so that properties can be read from them.
		await Promise.all(this.itemElementTags.map(tag => customElements.whenDefined(tag)));
		this.items = Array.from(this.children).filter((child): child is ArtboardItemElement =>
			this.itemElementTags.includes(child.localName),
		);
		const itemIds = new Set(this.items.map(item => item.id));
		this.selection = new Set([...this.selection].filter(id => itemIds.has(id)));
		if (this.editingId && !itemIds.has(this.editingId)) this.editingId = null;
		if (this.snapToGrid) this.snapAllItems();
		this.requestUpdate();
	}

	connectedCallback(): void {
		super.connectedCallback();
		this.updateItems();
		this.itemObserver.observe(this, { childList: true });
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.itemObserver.disconnect();
		this.stopGesture?.();
	}

	@queryAll("slot")
	accessor slots!: NodeListOf<HTMLSlotElement>;

	protected updated(changed: PropertyValues): void {
		const children = Array.from(this.children);
		this.slots.forEach(slot => {
			const refId = slot.dataset.childId;
			const item = children.find(child => child.id === refId);
			if (item) slot.assign(item);
		});
		if (this.snapToGrid && (changed.has("snapToGrid") || changed.has("gridColumns")) && this.snapAllItems()) {
			this.requestUpdate();
		}
	}

	render() {
		return html`
			<div
				${ref(this.containerRef)}
				class="artboard-container"
				tabindex="0"
				@keydown=${this.onKeyDown}
				@focusout=${this.onFocusOut}
			>
				<input
					class="file-input"
					type="file"
					accept="image/*"
					${ref(this.imageInputRef)}
					@change=${this.onBackgroundFileChange}
				/>
				${this.Header()} ${this.backgroundSrc ? this.Artboard() : this.BackgroundChooser()}
			</div>
		`;
	}

	private Header() {
		if (!this.isContentEditable) return nothing;

		return html`<header>
			<sl-button size="small">${msg("Debug")}</sl-button>
		</header>`;
	}

	private Artboard() {
		const selection = this.renderedSelectionBounds();

		return html`<div class="artboard" @pointerdown=${this.onPointerDown}>
			<div class="overlay" style=${styleMap({ pointerEvents: this.isContentEditable ? "auto" : "none" })}></div>

			${this.items.map(item => {
				const preview = this.preview.get(item.id);
				const geometry = preview ? this.snapGeometry(preview, item) : item;
				return html`<div
					class=${`item${item.id === this.editingId ? " editing" : ""}`}
					data-item-id=${item.id}
					?inert=${this.isContentEditable && item.id !== this.editingId}
					style=${styleMap({
						left: `${geometry.x}cqw`,
						top: `${geometry.y}cqw`,
						width: `${geometry.width}cqw`,
						height: `${geometry.height}cqw`,
					})}
				>
					<slot data-child-id=${item.id}></slot>
				</div>`;
			})}
			${this.marquee ? html`<div class="marquee" style=${this.geometryStyle(this.marquee)}></div>` : nothing}
			${selection
				? html`<div class="selection-box" style=${this.geometryStyle(selection)}>
						${RESIZE_DIRECTIONS.map(direction => html`<div class="handle" data-direction=${direction}></div>`)}
					</div>`
				: nothing}

			<img class="background" src=${this.backgroundSrc!} alt="" />
		</div> `;
	}

	focus() {
		this.containerRef.value?.focus({ preventScroll: true });
	}

	private geometryStyle(geometry: Geometry) {
		return styleMap({
			left: `${geometry.x}cqw`,
			top: `${geometry.y}cqw`,
			width: `${geometry.width}cqw`,
			height: `${geometry.height}cqw`,
		});
	}

	private snapGeometry(geometry: Geometry, item: ArtboardItemElement): Geometry {
		if (!this.snapToGrid || this.gridColumns < 1) return geometry;

		const cellSize = 100 / Math.round(this.gridColumns);
		const x = Math.round(geometry.x / cellSize) * cellSize;
		const y = Math.round(geometry.y / cellSize) * cellSize;
		const minimumWidth = Math.ceil(item.minimumWidth / cellSize) * cellSize;
		const minimumHeight = Math.ceil(item.minimumHeight / cellSize) * cellSize;
		const right = Math.max(x + minimumWidth, Math.round((geometry.x + geometry.width) / cellSize) * cellSize);
		const bottom = Math.max(y + minimumHeight, Math.round((geometry.y + geometry.height) / cellSize) * cellSize);
		return { x, y, width: right - x, height: bottom - y };
	}

	private snapAllItems() {
		let changed = false;
		for (const item of this.items) {
			const geometry = this.snapGeometry(item, item);
			if (
				geometry.x === item.x &&
				geometry.y === item.y &&
				geometry.width === item.width &&
				geometry.height === item.height
			)
				continue;
			Object.assign(item, geometry);
			changed = true;
		}
		return changed;
	}

	private renderedSelectionBounds() {
		const selected = this.items
			.filter(item => this.selection.has(item.id))
			.map(item => {
				const preview = this.preview.get(item.id);
				return preview ? this.snapGeometry(preview, item) : item;
			});
		if (!selected.length) return null;

		const x = Math.min(...selected.map(item => item.x));
		const y = Math.min(...selected.map(item => item.y));
		const right = Math.max(...selected.map(item => item.x + item.width));
		const bottom = Math.max(...selected.map(item => item.y + item.height));
		return { x, y, width: right - x, height: bottom - y };
	}

	private selectionBounds(geometry = this.preview) {
		const selected = this.items.filter(item => this.selection.has(item.id)).map(item => geometry.get(item.id) ?? item);
		if (!selected.length) return null;

		const x = Math.min(...selected.map(item => item.x));
		const y = Math.min(...selected.map(item => item.y));
		const right = Math.max(...selected.map(item => item.x + item.width));
		const bottom = Math.max(...selected.map(item => item.y + item.height));
		return { x, y, width: right - x, height: bottom - y };
	}

	private itemGeometry(item: ArtboardItemElement): Geometry {
		return { x: item.x, y: item.y, width: item.width, height: item.height };
	}

	private point(event: PointerEvent, artboard: HTMLElement) {
		const rect = artboard.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.width) * 100,
		};
	}

	private startGesture(
		artboard: HTMLElement,
		pointerId: number,
		cursor: string,
		onMove: (event: PointerEvent) => void,
		onEnd: (event: PointerEvent, cancelled: boolean) => void,
	) {
		const previousCursor = document.documentElement.style.cursor;
		const move = (event: PointerEvent) => {
			if (event.pointerId === pointerId) onMove(event);
		};
		const end = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			this.stopGesture?.();
			onEnd(event, event.type !== "pointerup");
		};
		this.stopGesture = () => {
			artboard.removeEventListener("pointermove", move);
			artboard.removeEventListener("pointerup", end);
			artboard.removeEventListener("pointercancel", end);
			artboard.removeEventListener("lostpointercapture", end);
			if (artboard.hasPointerCapture(pointerId)) artboard.releasePointerCapture(pointerId);
			document.documentElement.style.cursor = previousCursor;
			this.stopGesture = null;
		};
		artboard.addEventListener("pointermove", move);
		artboard.addEventListener("pointerup", end);
		artboard.addEventListener("pointercancel", end);
		artboard.addEventListener("lostpointercapture", end);
		document.documentElement.style.cursor = cursor;
		artboard.setPointerCapture(pointerId);
	}

	private onPointerDown = (event: PointerEvent) => {
		if (!this.isContentEditable || event.button !== 0 || this.stopGesture) return;

		const artboard = event.currentTarget as HTMLElement;
		const path = event.composedPath();
		const itemWrapper = path.find(target => target instanceof HTMLElement && target.classList.contains("item")) as
			| HTMLElement
			| undefined;
		if (itemWrapper?.dataset.itemId === this.editingId) return;

		event.preventDefault();
		this.focus();
		this.exitEditing();

		const handle = path.find(target => target instanceof HTMLElement && target.classList.contains("handle")) as
			| HTMLElement
			| undefined;
		if (handle) {
			this.startResize(event, artboard, handle.dataset.direction as ResizeDirection, getComputedStyle(handle).cursor);
			return;
		}

		const point = this.point(event, artboard);
		const item = [...this.items].reverse().find(item => {
			return (
				point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height
			);
		});
		if (item) this.startMove(event, artboard, item);
		else this.startMarquee(event, artboard);
	};

	private startMove(event: PointerEvent, artboard: HTMLElement, item: ArtboardItemElement) {
		const shift = event.shiftKey;
		const wasSelected = this.selection.has(item.id);
		const wasSoleSelection = wasSelected && this.selection.size === 1;

		if (shift) {
			if (!wasSelected) this.selection.add(item.id);
		} else if (!wasSelected) {
			this.selection = new Set([item.id]);
		}
		this.requestUpdate();

		const startPointer = this.point(event, artboard);
		const startClient = { x: event.clientX, y: event.clientY };
		const start = new Map(
			this.items
				.filter(candidate => this.selection.has(candidate.id))
				.map(candidate => [candidate.id, this.itemGeometry(candidate)] as const),
		);
		let dragged = false;
		const updatePreview = (pointerEvent: PointerEvent) => {
			const current = this.point(pointerEvent, artboard);
			if (
				!dragged &&
				Math.hypot(pointerEvent.clientX - startClient.x, pointerEvent.clientY - startClient.y) < CLICK_SLOP
			)
				return;
			dragged = true;
			this.preview = new Map(
				[...start].map(([id, geometry]) => [
					id,
					{
						...geometry,
						x: geometry.x + current.x - startPointer.x,
						y: geometry.y + current.y - startPointer.y,
					},
				]),
			);
			this.requestUpdate();
		};

		this.startGesture(artboard, event.pointerId, "default", updatePreview, (upEvent, cancelled) => {
			if (!cancelled) updatePreview(upEvent);
			if (dragged && !cancelled) this.commitPreview();
			else this.preview.clear();

			if (!dragged && !cancelled) {
				if (shift && wasSelected) this.selection.delete(item.id);
				else if (!shift && wasSoleSelection && item.hasEditableContent) {
					this.enterEditing(item, upEvent.clientX, upEvent.clientY);
					return;
				} else if (!shift) this.selection = new Set([item.id]);
			}
			this.requestUpdate();
		});
	}

	private startResize(event: PointerEvent, artboard: HTMLElement, direction: ResizeDirection, cursor: string) {
		const bounds = this.selectionBounds();
		if (!bounds) return;

		const startPointer = this.point(event, artboard);
		const start = new Map(
			this.items.filter(item => this.selection.has(item.id)).map(item => [item.id, this.itemGeometry(item)] as const),
		);
		const original = {
			x1: bounds.x,
			y1: bounds.y,
			x2: bounds.x + bounds.width,
			y2: bounds.y + bounds.height,
		};
		const minimumScaleX = Math.max(
			...this.items
				.filter(item => this.selection.has(item.id))
				.map(item => item.minimumWidth / start.get(item.id)!.width),
		);
		const minimumScaleY = Math.max(
			...this.items
				.filter(item => this.selection.has(item.id))
				.map(item => item.minimumHeight / start.get(item.id)!.height),
		);
		const updatePreview = (pointerEvent: PointerEvent) => {
			const current = this.point(pointerEvent, artboard);
			const next = { ...original };
			if (direction.includes("w")) next.x1 += current.x - startPointer.x;
			if (direction.includes("e")) next.x2 += current.x - startPointer.x;
			if (direction.includes("n")) next.y1 += current.y - startPointer.y;
			if (direction.includes("s")) next.y2 += current.y - startPointer.y;

			let scaleX = (next.x2 - next.x1) / bounds.width;
			let scaleY = (next.y2 - next.y1) / bounds.height;
			if ((direction.includes("w") || direction.includes("e")) && scaleX < minimumScaleX) {
				scaleX = minimumScaleX;
				if (direction.includes("w")) next.x1 = original.x2 - bounds.width * scaleX;
				else next.x2 = original.x1 + bounds.width * scaleX;
			}
			if ((direction.includes("n") || direction.includes("s")) && scaleY < minimumScaleY) {
				scaleY = minimumScaleY;
				if (direction.includes("n")) next.y1 = original.y2 - bounds.height * scaleY;
				else next.y2 = original.y1 + bounds.height * scaleY;
			}
			this.preview = new Map(
				[...start].map(([id, geometry]) => {
					const x1 = next.x1 + (geometry.x - original.x1) * scaleX;
					const x2 = next.x1 + (geometry.x + geometry.width - original.x1) * scaleX;
					const y1 = next.y1 + (geometry.y - original.y1) * scaleY;
					const y2 = next.y1 + (geometry.y + geometry.height - original.y1) * scaleY;
					return [
						id,
						{
							x: Math.min(x1, x2),
							y: Math.min(y1, y2),
							width: Math.abs(x2 - x1),
							height: Math.abs(y2 - y1),
						},
					] as const;
				}),
			);
			this.requestUpdate();
		};

		this.startGesture(artboard, event.pointerId, cursor, updatePreview, (upEvent, cancelled) => {
			if (!cancelled) {
				updatePreview(upEvent);
				this.commitPreview();
			} else {
				this.preview.clear();
				this.requestUpdate();
			}
		});
	}

	private startMarquee(event: PointerEvent, artboard: HTMLElement) {
		const base = event.shiftKey ? new Set(this.selection) : new Set<string>();
		if (!event.shiftKey) this.selection.clear();
		const start = this.point(event, artboard);
		const startClient = { x: event.clientX, y: event.clientY };
		let dragged = false;
		this.requestUpdate();
		const updateMarquee = (pointerEvent: PointerEvent) => {
			const current = this.point(pointerEvent, artboard);
			if (
				!dragged &&
				Math.hypot(pointerEvent.clientX - startClient.x, pointerEvent.clientY - startClient.y) < CLICK_SLOP
			)
				return;
			dragged = true;
			this.marquee = {
				x: Math.min(start.x, current.x),
				y: Math.min(start.y, current.y),
				width: Math.abs(current.x - start.x),
				height: Math.abs(current.y - start.y),
			};
			this.selection = new Set(base);
			for (const item of this.items) {
				if (
					item.x < this.marquee.x + this.marquee.width &&
					item.x + item.width > this.marquee.x &&
					item.y < this.marquee.y + this.marquee.height &&
					item.y + item.height > this.marquee.y
				)
					this.selection.add(item.id);
			}
			this.requestUpdate();
		};

		this.startGesture(artboard, event.pointerId, "default", updateMarquee, (upEvent, cancelled) => {
			if (!cancelled) updateMarquee(upEvent);
			if (cancelled) this.selection = base;
			this.marquee = null;
			this.requestUpdate();
		});
	}

	private commitPreview() {
		for (const [id, geometry] of this.preview) {
			const item = this.items.find(item => item.id === id);
			if (item) Object.assign(item, this.snapGeometry(geometry, item));
		}
		this.preview.clear();
		this.requestUpdate();
	}

	private async enterEditing(item: ArtboardItemElement, clientX: number, clientY: number) {
		this.editingId = item.id;
		this.requestUpdate();
		await this.updateComplete;

		item.focus({ preventScroll: true });

		const position = document.caretPositionFromPoint?.(clientX, clientY);
		if (position) {
			const range = document.createRange();
			range.setStart(position.offsetNode, position.offset);
			range.collapse(true);
			if (item.contains(range.startContainer)) {
				const selection = document.getSelection();
				selection?.removeAllRanges();
				selection?.addRange(range);
			}
		}
	}

	private exitEditing() {
		if (!this.editingId) return;
		const item = this.items.find(item => item.id === this.editingId);
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement && item?.contains(activeElement)) activeElement.blur();
		const selection = document.getSelection();
		if (item && (item.contains(selection?.anchorNode ?? null) || item.contains(selection?.focusNode ?? null))) {
			selection?.removeAllRanges();
		}
		this.editingId = null;
		this.requestUpdate();
	}

	private onKeyDown = (event: KeyboardEvent) => {
		if ((event.key === "Delete" || event.key === "Backspace") && this.selection.size) {
			event.preventDefault();
			event.stopPropagation();
			for (const item of this.items) if (this.selection.has(item.id)) item.remove();
			this.selection.clear();
			this.requestUpdate();
		}
	};

	private onFocusOut = () => {
		setTimeout(() => {
			if (this.classList.contains("ww-selected") || this.classList.contains("ww-selected-text-within")) return;
			this.exitEditing();
			this.selection.clear();
			this.requestUpdate();
		}, 10);
	};

	private openBackgroundFileDialog() {
		this.imageInputRef.value?.click();
	}

	private onBackgroundFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const file = input.files[0];
			const reader = new FileReader();
			reader.onload = () => {
				this.backgroundSrc = reader.result as string;
				input.value = ""; // Reset the input value to allow re-selecting the same file
			};
			reader.readAsDataURL(file);
		}
	}

	get dynamicActions() {
		return {
			openBackgroundFileDialog: { label: { _: msg("Choose Background") } },
		} as Record<string, ActionDeclaration>;
	}

	private BackgroundChooser() {
		// TODO: Make more beautiful

		return html`
			<div class="background-chooser">
				<sl-button @click=${this.openBackgroundFileDialog}>${msg("Choose Background")}</sl-button>
			</div>
		`;
	}
}

export abstract class ArtboardItemElement extends LitElementWw {
	abstract hasEditableContent: boolean;
	abstract minimumWidth: number;
	abstract minimumHeight: number;

	@property({ type: Number, attribute: true, reflect: true })
	accessor x!: number;

	@property({ type: Number, attribute: true, reflect: true })
	accessor y!: number;

	@property({ type: Number, attribute: "w", reflect: true })
	accessor width!: number;

	@property({ type: Number, attribute: "h", reflect: true })
	accessor height!: number;
}
