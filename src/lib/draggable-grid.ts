import { css, html, LitElement } from "lit";
import { property, queryAssignedElements } from "lit/decorators.js";

declare global {
	interface HTMLElementTagNameMap {
		"draggable-grid": DraggableGrid;
	}
}

/** Implemented by children that want a nested element to be animated instead of themselves. */
export interface DraggableGridItem {
	get draggableElement(): HTMLElement;
}

export type DraggableGridReorderDetail = {
	/** The child element that was dragged. */
	item: HTMLElement;
	/** The child element `item` should be inserted before, or `null` to place it last. */
	before: HTMLElement | null;
	/** IDs of the draggable children in their new order; non-draggable children are omitted. */
	order: string[];
};

/** Fired after a drop settled on a position other than the one the drag started from. */
export class DraggableGridReorderEvent extends CustomEvent<DraggableGridReorderDetail> {
	constructor(detail: DraggableGridReorderDetail) {
		super("reorder", { detail });
	}
}

type Point = { x: number; y: number };

type SnapshotItem = Point & {
	draggable: boolean;
	height: number;
};

/** Geometry of the grid and its children, measured once when a drag starts. */
type Snapshot = {
	columnWidths: number[];
	rowGap: number;
	columnGap: number;
	/** IDs of all children in DOM order, draggable or not. */
	order: string[];
	items: Map<string, SnapshotItem>;
};

type DragSession = {
	/** `dragging` while the pointer is down, `settling` while the drop animation runs. */
	phase: "dragging" | "settling";
	id: string;
	pointerId: number;
	/** Top left corner of the dragged item relative to the grid, when the drag started. */
	startCorner: Point;
	/** Pointer position relative to the grid, when the drag started. */
	startPointer: Point;
	/** Latest pointer position, in client coordinates. */
	pointer: Point;
	/** Order the items are currently laid out in, and the one they settle into on drop. */
	order: string[];
	/** Dispatched once the drop animation finished, unless the order ended up unchanged. */
	reorder: DraggableGridReorderDetail | null;
	frame: number | null;
	maxScrollY: number;
	previousCursor: string;
};

/** Distance from the viewport edge at which auto scrolling kicks in, and its top speed. */
const AUTO_SCROLL_EDGE = 80;
const AUTO_SCROLL_SPEED = 18;
/** How far outside the grid the pointer may stray before auto scrolling stops. */
const AUTO_SCROLL_MARGIN = 120;

/**
 * Walks the grid slot by slot for the given order, yielding the top-left corner of each
 * slot. Emits `order.length + 1` positions: one per item plus the trailing slot, so it can
 * be used both to lay out items and to hit-test insertion points. This is the single source
 * of truth for the grid geometry.
 */
function* slotPositions(
	snapshot: Snapshot,
	order: string[],
): Generator<{ index: number; id: string | undefined; x: number; y: number }> {
	const { columnWidths, columnGap, rowGap } = snapshot;
	const columns = columnWidths.length;

	let currentRowHeight = 0;
	let x = 0;
	let y = 0;

	for (let i = 0; i <= order.length; i++) {
		const id = order[i];
		yield { index: i, id, x, y };

		const item = id !== undefined ? snapshot.items.get(id) : undefined;
		if (!item) continue;

		currentRowHeight = Math.max(currentRowHeight, item.height);
		x += columnGap + columnWidths[i % columns];
		if ((i + 1) % columns === 0) {
			x = 0;
			y += currentRowHeight + rowGap;
			currentRowHeight = 0;
		}
	}
}

function documentMaxScrollY() {
	const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
	return Math.max(0, documentHeight - window.innerHeight);
}

/** Pixels the page should scroll this frame while the pointer sits near a viewport edge. */
function autoScrollDelta(pointerY: number) {
	if (pointerY < AUTO_SCROLL_EDGE) {
		return -AUTO_SCROLL_SPEED * ((AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE);
	}
	const bottomEdge = window.innerHeight - AUTO_SCROLL_EDGE;
	if (pointerY > bottomEdge) {
		return AUTO_SCROLL_SPEED * ((pointerY - bottomEdge) / AUTO_SCROLL_EDGE);
	}
	return 0;
}

export class DraggableGrid extends LitElement {
	static styles = css`
		slot {
			display: contents;
		}
	`;

	private static readonly TRANSITION_MS = 200;
	private static readonly TRANSITION = `transform ${DraggableGrid.TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

	private snapshot: Snapshot | null = null;
	private session: DragSession | null = null;

	@property({ type: String, attribute: true })
	accessor dragHandleSelector: string = "[data-drag-handle]";

	@property({ type: String, attribute: true })
	accessor dragNoHandleSelector: string = "[data-drag-no-handle]";

	@property({ type: Boolean, attribute: true })
	accessor vertical: boolean = false;

	@queryAssignedElements({ flatten: true })
	private accessor slotElements!: HTMLElement[];

	connectedCallback(): void {
		super.connectedCallback();
		this.addEventListener("pointerdown", this.onPointerDown);
		this.addEventListener("pointermove", this.onPointerMove);
		document.addEventListener("scroll", this.onScroll);
		this.addEventListener("pointerup", this.onPointerUp);
		this.addEventListener("pointercancel", this.onPointerUp);
		this.addEventListener("lostpointercapture", this.onPointerUp);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener("pointerdown", this.onPointerDown);
		this.removeEventListener("pointermove", this.onPointerMove);
		document.removeEventListener("scroll", this.onScroll);
		this.removeEventListener("pointerup", this.onPointerUp);
		this.removeEventListener("pointercancel", this.onPointerUp);
		this.removeEventListener("lostpointercapture", this.onPointerUp);
	}

	render() {
		return html`<slot></slot>`;
	}

	// Since we are working with ProseMirror, we always have to freshly resolve elements based
	// on their ID, as ProseMirror may have replaced the element in the DOM. We cannot rely on
	// elements cached in the snapshot or the drag session.

	private childById(id: string): HTMLElement | undefined {
		return this.slotElements.find(el => el.id === id);
	}

	/** The element that is transformed for a child: either a nested one it provides, or itself. */
	private animatedElement(id: string): HTMLElement {
		const child = this.childById(id);
		return child && "draggableElement" in child ? (child as DraggableGridItem).draggableElement : child!;
	}

	private measure(): Snapshot {
		const style = window.getComputedStyle(this);
		const rect = this.getBoundingClientRect();
		const snapshot: Snapshot = {
			columnWidths: this.vertical ? [rect.width] : style.gridTemplateColumns.split(" ").map(parseFloat),
			rowGap: parseFloat(style.rowGap.replace("normal", "0")),
			columnGap: parseFloat(style.columnGap.replace("normal", "0")),
			order: [],
			items: new Map(),
		};

		for (const child of this.slotElements) {
			if (!child.id) {
				console.warn("DraggableGrid: child element is missing an id", child);
				continue;
			}
			const itemRect = this.animatedElement(child.id).getBoundingClientRect();
			snapshot.items.set(child.id, {
				draggable: !child.hasAttribute("data-not-draggable"),
				height: itemRect.height,
				x: itemRect.x - rect.x,
				y: itemRect.y - rect.y,
			});
			snapshot.order.push(child.id);
		}

		return snapshot;
	}

	/** Moves every item to the slot it occupies in `order`, except the one under the pointer. */
	private layout(order: string[]) {
		const snapshot = this.snapshot;
		if (!snapshot) return;
		const draggedId = this.session?.phase === "dragging" ? this.session.id : undefined;

		for (const { id, x, y } of slotPositions(snapshot, order)) {
			if (id === undefined || id === draggedId) continue;
			const item = snapshot.items.get(id);
			if (!item) continue; // This should not happen
			this.animatedElement(id).style.transform = `translate(${x - item.x}px, ${y - item.y}px)`;
		}
	}

	private onPointerDown = (event: PointerEvent) => {
		if (this.session) return;

		const path = event.composedPath();
		if (!path.find(el => el instanceof HTMLElement && el.matches(this.dragHandleSelector))) return;
		if (path.find(el => el instanceof HTMLElement && el.matches(this.dragNoHandleSelector))) return;

		const child = path.find(
			el => el instanceof HTMLElement && this.slotElements.includes(el) && !el.hasAttribute("data-not-draggable"),
		) as HTMLElement | undefined;
		if (!child?.id) return;
		const element = this.animatedElement(child.id);
		if (!element) return;

		event.preventDefault();

		this.snapshot = this.measure();
		for (const id of this.snapshot.order) this.animatedElement(id).style.transition = DraggableGrid.TRANSITION;

		element.style.transition = "none";
		element.style.zIndex = "1000";
		element.classList.add("ww-dragging");

		const rect = this.getBoundingClientRect();
		const itemRect = element.getBoundingClientRect();
		this.session = {
			phase: "dragging",
			id: child.id,
			pointerId: event.pointerId,
			startCorner: { x: itemRect.left - rect.left, y: itemRect.top - rect.top },
			startPointer: { x: event.clientX - rect.left, y: event.clientY - rect.top },
			pointer: { x: event.clientX, y: event.clientY },
			order: [...this.snapshot.order],
			reorder: null,
			frame: null,
			maxScrollY: documentMaxScrollY(),
			previousCursor: document.documentElement.style.cursor,
		};

		document.documentElement.style.cursor = "grabbing";
		this.setPointerCapture(event.pointerId);
	};

	private onPointerMove = (event: PointerEvent) => {
		const session = this.session;
		if (session?.phase !== "dragging" || event.pointerId !== session.pointerId) return;
		event.preventDefault();
		session.pointer = { x: event.clientX, y: event.clientY };
		this.scheduleFrame();
	};

	private onPointerUp = (event: PointerEvent) => {
		const session = this.session;
		if (session?.phase !== "dragging" || event.pointerId !== session.pointerId) return;
		event.preventDefault();

		this.cancelFrame();
		session.phase = "settling";
		this.animatedElement(session.id).style.transition = DraggableGrid.TRANSITION;
		this.layout(session.order);

		try {
			this.releasePointerCapture(event.pointerId);
		} catch {
			// Pointer capture may already be gone after a lostpointercapture event.
		}

		setTimeout(() => this.endDrag(session), DraggableGrid.TRANSITION_MS);
	};

	private onScroll = () => {
		this.scheduleFrame();
	};

	/** Drops all drag styling once the settle animation finished and reports the new order. */
	private endDrag(session: DragSession) {
		if (this.session !== session) return;
		this.session = null;
		this.snapshot = null;

		for (const child of this.slotElements) {
			const element = this.animatedElement(child.id);
			element.style.transition = "";
			element.style.transform = "";
			element.style.zIndex = "";
			element.classList.remove("ww-dragging");
		}
		document.documentElement.style.cursor = session.previousCursor;

		if (session.reorder) this.dispatchEvent(new DraggableGridReorderEvent(session.reorder));
	}

	private scheduleFrame() {
		const session = this.session;
		if (session?.phase !== "dragging" || session.frame !== null) return;
		session.frame = requestAnimationFrame(() => this.runFrame());
	}

	private cancelFrame() {
		const session = this.session;
		if (!session || session.frame === null) return;
		cancelAnimationFrame(session.frame);
		session.frame = null;
	}

	private runFrame() {
		const session = this.session;
		if (!session) return;
		session.frame = null;
		if (session.phase !== "dragging") return;

		const rect = this.getBoundingClientRect();
		const deltaX = this.vertical ? 0 : session.pointer.x - rect.left - session.startPointer.x;
		const deltaY = session.pointer.y - rect.top - session.startPointer.y;
		this.animatedElement(session.id).style.transform = `translate(${deltaX}px, ${deltaY}px)`;

		this.updateDropTarget({ x: session.startCorner.x + deltaX, y: session.startCorner.y + deltaY });

		// Auto scrolling moves the pointer relative to the grid, so keep the loop running.
		if (this.autoScroll()) this.scheduleFrame();
	}

	private autoScroll(): boolean {
		const session = this.session;
		if (!session) return false;

		const pointerY = session.pointer.y;
		const rect = this.getBoundingClientRect();
		if (pointerY < rect.top - AUTO_SCROLL_MARGIN || pointerY > rect.bottom + AUTO_SCROLL_MARGIN) return false;

		const delta = autoScrollDelta(pointerY);
		if (delta === 0) return false;

		const nextScrollY = Math.min(session.maxScrollY, Math.max(0, window.scrollY + delta));
		if (nextScrollY === window.scrollY) return false;

		window.scrollTo(window.scrollX, nextScrollY);
		return true;
	}

	/** Picks the slot closest to the dragged item and animates the others out of its way. */
	private updateDropTarget(target: Point) {
		const session = this.session;
		const snapshot = this.snapshot;
		if (!session || !snapshot) return;

		// A single draggable item cannot be reordered.
		const isDraggable = (id: string) => snapshot.items.get(id)?.draggable ?? false;
		if (!snapshot.order.some(id => id !== session.id && isDraggable(id))) {
			session.order = snapshot.order;
			session.reorder = null;
			return;
		}

		const others = snapshot.order.filter(id => id !== session.id);
		const insertIndex = this.findInsertIndex(others, target);
		if (insertIndex === -1) return;

		const order = others.toSpliced(insertIndex, 0, session.id);
		this.layout(order);
		session.order = order;
		session.reorder = order.every((id, index) => id === snapshot.order[index]) ? null : this.buildReorder(order);
	}

	/** Index in `order` at which the dragged item would land, or -1 if there is no valid slot. */
	private findInsertIndex(order: string[], target: Point): number {
		const snapshot = this.snapshot!;
		const isDraggable = (index: number) =>
			index >= 0 && index < order.length && (snapshot.items.get(order[index])?.draggable ?? false);

		let bestIndex = -1;
		let bestDistance = Infinity;

		for (const { index, x, y } of slotPositions(snapshot, order)) {
			// Prevent dropping between two non-draggable items
			if (!isDraggable(index - 1) && !isDraggable(index)) continue;

			const distance = Math.hypot(x - target.x, y - target.y);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		}

		return bestIndex;
	}

	private buildReorder(order: string[]): DraggableGridReorderDetail | null {
		const snapshot = this.snapshot!;
		const item = this.childById(this.session!.id);
		if (!item) return null;

		const following = order.slice(order.indexOf(item.id) + 1);
		const anchorId = following.find(id => snapshot.items.get(id)?.draggable);

		return {
			item,
			before: (anchorId !== undefined && this.childById(anchorId)) || null,
			order: order.filter(id => snapshot.items.get(id)?.draggable),
		};
	}
}
