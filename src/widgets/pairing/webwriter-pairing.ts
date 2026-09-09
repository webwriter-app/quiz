import { msg } from "@lit/localize";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { ActionDeclaration, LitElementWw, OptionDeclaration } from "@webwriter/lit";
import PlusIcon from "bootstrap-icons/icons/plus.svg";
import ShuffleIcon from "bootstrap-icons/icons/shuffle.svg";
import TrashIcon from "bootstrap-icons/icons/trash.svg";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, queryAll, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import GripHorizontalIcon from "../../../assets/icons/grip-horizontal.svg";
import { name as packageId } from "../../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../../api";
import { DraggableGrid, DraggableGridReorderEvent } from "../../lib/draggable-grid";
import { encryptedProperty, encryptPlaintextAttributes } from "../../lib/encrypted-property";
import { BiMap, randomizeArray } from "../../lib/utils";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-pairing": WebwriterPairing;
	}
}

export type PairingMode = "pairing" | "memory";

type PairingQuizState = {
	leftItemIds: string[];
	rightItemIds: string[];
	assignments: BiMap<string, string>;
};

type PairingDragState = {
	element: HTMLElement;
	cardId: string;
	pointerId: number;
	/** Transform placing the card where it was picked up; its scale grows to full size. */
	base: { x: number; y: number; scale: number };
	/** The assigned cell the card was taken out of, which shows its partner full size meanwhile. */
	sourceCell: HTMLElement | null;
	startPageX: number;
	startPageY: number;
	clientX: number;
	clientY: number;
	startTime: number;
	lastFrameTime: number;
	frame: number | null;
	highlight: HTMLElement | null;
	maxPageScrollY: number;
};

type MemoryGameState = {
	itemIds: string[];
	flippedItemIds: string[];
	matchedItemIds: string[];
};

registerQuizType({
	packageId,
	widgetPosition: 40,
	id: "webwriter-pairing",
	getName: () => msg("Pairing"),
	icon: ShuffleIcon,
	createInstance: () => document.createElement("webwriter-pairing"),
});

const AUTO_SCROLL_EDGE_SIZE = 80; // px
const AUTO_SCROLL_SPEED = 1000; // px/s

const PAIRING_LIFT_MS = 140;
const PAIRING_SETTLE_MS = 260;
const PAIRING_SETTLE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

function easeOut(progress: number) {
	return 1 - Math.pow(1 - progress, 3);
}

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The `transform` that renders `element` (which must not have one) at `from`. Cards are sized
 * by CSS `scale`, which applies before `transform` and thus scales its translation, and around
 * a `transform-origin` that shifts the box whenever the scale changes: both are compensated.
 */
function transformTo(element: HTMLElement, from: DOMRect) {
	const current = element.getBoundingClientRect();
	if (!current.width || !element.offsetWidth) return null;

	const cssScale = current.width / element.offsetWidth;
	const scale = from.width / current.width;
	const [originX, originY] = window.getComputedStyle(element).transformOrigin.split(" ").map(parseFloat);

	return {
		x: (from.x - current.x) / cssScale + originX * (scale - 1),
		y: (from.y - current.y) / cssScale + originY * (scale - 1),
		scale,
	};
}

/**
 * An answer where learners match items into pairs.
 *
 * The items must be `<webwriter-pairing-item>` children of this element.
 */
@customElement("webwriter-pairing")
export class WebwriterPairing extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	static shadowRootOptions = {
		...LitElementWw.shadowRootOptions,
		slotAssignment: "manual" as const,
	};

	/** @internal */
	static scopedElements = {
		"draggable-grid": DraggableGrid,
		"sl-icon": SlIcon,
		"sl-icon-button": SlIconButton,
	};

	static styles = css`
		:host {
			display: block;
			--grid-gap: var(--sl-spacing-medium);
			--item-min-width: 120px;
			--pair-min-width: calc(var(--item-min-width) * 2 + 3px); /* incl. 2*border + divider */
			outline: none !important;
		}

		.pairs {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(var(--pair-min-width), 1fr));
			gap: var(--grid-gap);
		}

		.pair {
			position: relative;

			.pair-content {
				display: grid;
				grid-template-columns: 1fr 1px 1fr;
				box-sizing: border-box;

				border: 1px solid var(--sl-color-neutral-300);
				border-radius: var(--sl-border-radius-medium);
				background-color: var(--sl-color-neutral-0);
				overflow: hidden;
			}

			.actions {
				height: 1lh;
				display: flex;
				align-items: center;
				position: absolute;
				background: var(--sl-color-neutral-0);
				border: 1px solid var(--sl-input-border-color);
				border-radius: var(--sl-border-radius-pill);
				top: 0;
				left: 50%;
				translate: -50% -50%;
				padding: 0 var(--sl-spacing-x-small);
				box-sizing: border-box;
				z-index: 100;

				opacity: 0;

				&:hover,
				.pair:hover &,
				.pair.ww-dragging & {
					opacity: 1;
				}
			}
		}

		.divider {
			height: 100%;
			width: 100%;
			background-color: var(--sl-color-neutral-300);
		}

		#add-pair {
			display: grid;
			grid-template-columns: 1fr 1px 1fr;
			position: relative;
			place-items: center;

			/* Match styling of Shoelace button */
			border: 1px dashed var(--sl-color-neutral-300);
			border-radius: var(--sl-border-radius-medium);
			box-sizing: border-box;
			color: var(--sl-color-neutral-500);
			cursor: pointer;
			&:hover {
				background-color: var(--sl-color-primary-50);
				border-color: var(--sl-color-primary-300);
				color: var(--sl-color-primary-700);
			}

			.label {
				position: absolute;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				color: var(--sl-color-neutral-500);
			}

			.size-placeholder {
				aspect-ratio: 1 / 1;
				width: 100%;
			}
		}

		.pairing-container {
			display: grid;
			grid-template-columns: 1fr 1px 1fr;
			gap: var(--grid-gap);
		}

		.pairing-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(var(--item-min-width), 1fr));
			gap: var(--grid-gap);
		}

		.pairing-cell {
			aspect-ratio: 1 / 1;
			position: relative;
			border-radius: var(--sl-border-radius-medium);

			/* Ring marking the cell a drop would land in. */
			&::before {
				content: "";
				position: absolute;
				inset: -4px;
				border: 2px dashed var(--sl-color-primary-400);
				border-radius: calc(var(--sl-border-radius-medium) + 3px);
				pointer-events: none;
				opacity: 0;
				transition: var(--sl-transition-fast) opacity;
				z-index: 2;
			}

			&.ww-drag-over::before {
				opacity: 1;
			}
		}

		.pairing-backdrop {
			position: absolute;
			inset: 0;
			background-color: var(--sl-color-neutral-50);
			border-radius: var(--sl-border-radius-medium);
			transition: var(--sl-transition-fast) background-color;

			.ww-drag-over > & {
				background-color: var(--sl-color-primary-100);
			}
		}

		.pairing-card {
			/* All cards fill their cell exactly, so that dragging one never changes the layout. */
			position: absolute;
			inset: 0;
			box-sizing: border-box;

			border: 1px solid var(--sl-color-neutral-300);
			border-radius: var(--sl-border-radius-medium);
			background-color: var(--sl-color-neutral-0);
			overflow: hidden;
			user-select: none;

			/* transform is left out: it is driven frame by frame while dragging. */
			transition:
				var(--sl-transition-fast) border-color,
				var(--sl-transition-fast) background-color;

			/* Overlay to prevent any pointer events on the card itself, so that all interactions stay inside this shadow DOM */
			&::after {
				content: "";
				position: absolute;
				inset: 0;
			}

			&[data-draggable] {
				cursor: grab;
				/* Required so that touch dragging does not scroll the page instead. */
				touch-action: none;
			}

			&[data-draggable]:hover {
				border-color: var(--sl-color-primary-300);
				background-color: var(--sl-color-primary-50);
			}

			&.correct {
				border-color: var(--sl-color-success-600);
				background-color: var(--sl-color-success-50);
			}

			&.incorrect {
				border-color: var(--sl-color-danger-600);
				background-color: var(--sl-color-danger-50);
			}

			&.ww-dragging {
				z-index: 1000;
				pointer-events: none;
				cursor: grabbing;
				border-color: var(--sl-color-primary-400);
				background-color: var(--sl-color-primary-50);
				/* The dragged card scales via its transform, so that translating it stays a
				   1:1 match for the pointer movement. */
				scale: 1 !important;
			}
		}

		.pairing-index {
			position: absolute;
			top: 4px;
			right: 4px;
			display: grid;
			place-items: center;
			box-sizing: border-box;
			min-width: 1.6em;
			height: 1.6em;
			padding: 0 0.3em;
			border-radius: var(--sl-border-radius-circle);
			background-color: var(--sl-color-neutral-100);
			line-height: 1;
			color: var(--sl-color-neutral-700);
			font-size: var(--sl-font-size-medium);
			font-weight: var(--sl-font-weight-semibold);
		}

		/* A cell holding an assignment shows both cards side by side at a reduced size. */
		.pairing-assigned {
			.pairing-card-normal {
				scale: 0.68;
				transform-origin: bottom right;
			}

			.pairing-card-assigned {
				scale: 0.68;
				transform-origin: top left;
			}

			/* While its partner is dragged away, the remaining card takes the cell back. */
			&.ww-drag-source .pairing-card-normal {
				scale: 1;
			}
		}

		.memory-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(var(--item-min-width), 1fr));
			gap: var(--grid-gap);
		}

		.memory-card {
			min-width: 0;
			padding: 0;
			border: 0;
			aspect-ratio: 1 / 1;
			background: transparent;
			color: inherit;
			font: inherit;
			cursor: pointer;
			perspective: 800px;
			transition: opacity 160ms ease;

			&:focus-visible {
				outline: var(--sl-focus-ring-width) solid var(--sl-focus-ring-color);
				outline-offset: var(--sl-focus-ring-offset);
				border-radius: var(--sl-border-radius-medium);
			}

			&.matched {
				opacity: 0.55;
			}

			&:disabled {
				cursor: default;
			}

			&.flipped .memory-card-inner {
				transform: rotateY(180deg);
			}
		}

		.memory-card-inner {
			position: relative;
			display: block;
			width: 100%;
			height: 100%;
			transition: transform 300ms ease;
			transform-style: preserve-3d;
		}

		.memory-card-face {
			position: absolute;
			inset: 0;
			display: grid;
			place-items: center;
			box-sizing: border-box;
			border: 1px solid var(--sl-color-neutral-300);
			border-radius: var(--sl-border-radius-medium);
			overflow: hidden;
			background: var(--sl-color-neutral-0);
			backface-visibility: hidden;
		}

		.memory-card-back {
			border: 0;
			background: var(--sl-color-primary-600);
			color: var(--sl-color-neutral-0);
			font-size: calc(var(--item-min-width) / 3);
			font-weight: var(--sl-font-weight-bold);
		}

		.memory-card-front {
			transform: rotateY(180deg);

			slot {
				width: 100%;
				height: 100%;
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.memory-card-inner {
				transition-duration: 0ms;
			}
		}
	`;

	/**
	 * How learners match the items.
	 *
	 * - `pairing`: All items are visible and learners drag them together.
	 * - `memory`: The items are face down and learners uncover two at a time.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor mode: PairingMode = "pairing";

	/**
	 * The pairs counting as correct, as tuples of the two item IDs. It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: true, reflect: true, converter: encryptedProperty })
	accessor solution: [string, string][] = [];

	/** @internal */
	@queryAll("slot")
	accessor slots!: NodeListOf<HTMLSlotElement>;

	@state()
	private accessor graded = false;

	@state()
	private accessor detailedFeedback = false;

	private get showFeedback() {
		return this.graded && this.detailedFeedback;
	}

	/** Index of the pair an item belongs to, or -1 if it belongs to none. */
	private pairIndex(itemId: string) {
		return this.solution.findIndex(pair => pair.includes(itemId));
	}

	private addPair() {
		const insertItem = () => {
			// Insert new items at a random position to not make the pairing obvious from the order of the items in the DOM.
			const randomIndex = Math.floor(Math.random() * (this.children.length + 1));
			const newItem = document.createElement("webwriter-pairing-item");
			if (randomIndex === this.children.length) this.appendChild(newItem);
			else this.insertBefore(newItem, this.children[randomIndex]);
			return newItem.id;
		};

		this.solution = [...this.solution, [insertItem(), insertItem()]];
	}

	private removePair(a: string, b: string) {
		this.querySelector(`webwriter-pairing-item#${a}`)?.remove();
		this.querySelector(`webwriter-pairing-item#${b}`)?.remove();
		this.solution = this.solution.filter(([idA, idB]) => idA !== a && idB !== b);
	}

	private renderAuthoringView() {
		return html`
			<draggable-grid
				class="pairs"
				@reorder=${({ detail }: DraggableGridReorderEvent) => {
					const pairs = this.solution;
					this.solution = detail.order.map(id => pairs[Number(id.substring("pair-".length))]);
				}}
			>
				${this.solution.map(
					([a, b], index) =>
						html`<div class="pair" id=${`pair-${index}`}>
							<div class="actions">
								<sl-icon-button class="drag-handle" data-drag-handle src=${GripHorizontalIcon}></sl-icon-button>
								<sl-icon-button src=${TrashIcon} @click=${() => this.removePair(a, b)}></sl-icon-button>
							</div>
							<div class="pair-content">
								<slot data-child-id=${a}></slot>
								<div class="divider"></div>
								<slot data-child-id=${b}></slot>
							</div>
						</div>`,
				)}
				<div @click=${this.addPair} id="add-pair" data-not-draggable>
					<div class="label"><sl-icon src=${PlusIcon}></sl-icon>${msg("Add Pair")}</div>
					<!-- Required so that the height of add-pair always matches the height of the pairings -->
					<div class="size-placeholder"></div>
				</div>
			</draggable-grid>
		`;
	}

	@state()
	private accessor pairingQuiz: PairingQuizState | null = null;
	private pairingDragState: PairingDragState | null = null;
	private pairingSettleTimeout?: ReturnType<typeof setTimeout>;

	private resetPairingQuiz() {
		this.pairingQuiz = {
			leftItemIds: randomizeArray(this.solution.map(([a]) => a)),
			rightItemIds: randomizeArray(this.solution.map(([, b]) => b)),
			assignments: new BiMap(),
		};
	}

	private renderPairingView() {
		if (!this.pairingQuiz) return nothing;
		const { leftItemIds, rightItemIds, assignments } = this.pairingQuiz;
		return html`
			<div
				class="pairing-container"
				@pointerdown=${this.onPairingPointerDown}
				@pointermove=${this.onPairingPointerMove}
				@pointerup=${this.onPairingPointerEnd}
				@pointercancel=${this.onPairingPointerEnd}
				@lostpointercapture=${this.onPairingPointerEnd}
			>
				<div class="pairing-grid pairing-left" data-drop-target>
					${leftItemIds.map(
						id =>
							html`<div class="pairing-cell" data-cell-id=${id}>
								<div class="pairing-backdrop"></div>
								${assignments.hasKey(id) ? nothing : this.renderPairingCard(id)}
							</div>`,
					)}
				</div>
				<div class="divider"></div>
				<div class="pairing-grid pairing-right">
					${rightItemIds.map(id => {
						const assignedId = assignments.getKey(id);
						const correct = assignedId !== undefined && this.pairIndex(assignedId) === this.pairIndex(id);
						const feedback = this.showFeedback ? (correct ? " correct" : " incorrect") : "";
						return html`<div
							class=${classMap({ "pairing-cell": true, "pairing-assigned": !!assignedId })}
							data-drop-target
							data-drop-target-id=${id}
						>
							${this.renderPairingCard(id, "pairing-card-normal", false)}
							${assignedId ? this.renderPairingCard(assignedId, `pairing-card-assigned${feedback}`) : nothing}
						</div>`;
					})}
				</div>
			</div>
		`;
	}

	private renderPairingCard(id: string, variant = "", draggable = true) {
		const index = this.showFeedback ? this.pairIndex(id) : -1;
		return html`<div class="pairing-card ${variant}" data-card-id=${id} ?data-draggable=${draggable && !this.graded}>
			<slot data-child-id=${id}></slot>
			${index < 0 ? nothing : html`<span class="pairing-index">${index + 1}</span>`}
		</div>`;
	}

	private get pairingCards() {
		return Array.from(this.renderRoot.querySelectorAll<HTMLElement>(".pairing-card[data-card-id]"));
	}

	private animatePairingCard(card: HTMLElement, from: DOMRect, duration = PAIRING_SETTLE_MS) {
		const invert = prefersReducedMotion() ? null : transformTo(card, from);
		if (!invert || (Math.abs(invert.x) < 0.5 && Math.abs(invert.y) < 0.5 && Math.abs(invert.scale - 1) < 0.005))
			return false;

		card.style.transform = `translate(${invert.x}px, ${invert.y}px) scale(${invert.scale})`;
		// Flush the inverted position so that the transition starts from it.
		void card.offsetHeight;
		card.style.transition = `transform ${duration}ms ${PAIRING_SETTLE_EASING}`;
		card.style.transform = "";
		return true;
	}

	private flipPairingCards(from: Map<string, DOMRect>, droppedCardId: string) {
		this.finishPairingSettle();

		let settling = false;
		for (const card of this.pairingCards) {
			const previous = from.get(card.dataset.cardId!);
			if (!previous || !this.animatePairingCard(card, previous)) continue;
			// Cards paint in DOM order, so one flying back to the left grid would pass behind the
			// cards it travels over, and the dropped one behind the card it swapped with.
			card.style.zIndex = card.dataset.cardId === droppedCardId ? "1001" : "1000";
			settling = true;
		}
		if (settling) this.pairingSettleTimeout = setTimeout(() => this.finishPairingSettle(), PAIRING_SETTLE_MS);
	}

	private finishPairingSettle() {
		clearTimeout(this.pairingSettleTimeout);
		this.pairingSettleTimeout = undefined;
		for (const card of this.pairingCards) {
			card.style.transition = "";
			card.style.transform = "";
			card.style.transformOrigin = "";
			card.style.zIndex = "";
		}
	}

	private pairingDropCell(state: PairingDragState, clientX: number, clientY: number) {
		const target = this.shadowRoot!.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-drop-target]");
		if (!target || !this.pairingQuiz) return null;

		// Only the right cells carry an ID; the left grid takes a card back into its own cell.
		const { assignments } = this.pairingQuiz;
		const rightId = target.dataset.dropTargetId;
		if (rightId === undefined)
			return assignments.hasKey(state.cardId)
				? this.renderRoot.querySelector<HTMLElement>(`.pairing-left [data-cell-id="${state.cardId}"]`)
				: null;
		return assignments.getValue(state.cardId) === rightId ? null : target;
	}

	private applyPairingDrop(state: PairingDragState, cell: HTMLElement) {
		const { assignments } = this.pairingQuiz!;
		const rightId = cell.dataset.dropTargetId;
		if (rightId === undefined) {
			assignments.deleteKey(state.cardId);
			return;
		}

		// If both cells are taken, the card that has to make room takes the freed one.
		const displacedId = assignments.getKey(rightId);
		const originId = assignments.getValue(state.cardId);
		if (displacedId !== undefined && originId !== undefined) assignments.set(displacedId, originId);
		assignments.set(state.cardId, rightId);
	}

	private requestPairingAnimationFrame() {
		if (this.pairingDragState?.frame === null)
			this.pairingDragState.frame = requestAnimationFrame(time => this.onPairingAnimationFrame(time));
	}

	private autoScrollPairing(state: PairingDragState, deltaTime: number) {
		const edgeSize = Math.min(AUTO_SCROLL_EDGE_SIZE, window.innerHeight / 4);
		const direction = state.clientY < edgeSize ? -1 : state.clientY > window.innerHeight - edgeSize ? 1 : 0;
		const scrollingElement = document.scrollingElement ?? document.documentElement;
		const scrollY = scrollingElement.scrollTop;

		const distance = direction * AUTO_SCROLL_SPEED * (deltaTime / 1000);
		scrollingElement.scrollTop = Math.min(state.maxPageScrollY, Math.max(0, scrollY + distance));
		return scrollingElement.scrollTop !== scrollY;
	}

	private onPairingAnimationFrame(time: number) {
		const state = this.pairingDragState;
		if (!state) return;
		state.frame = null;
		// Clamped so that a dropped frame cannot scroll the page in one jump.
		const scrolled = this.autoScrollPairing(state, Math.min(64, time - state.lastFrameTime));
		state.lastFrameTime = time;

		const lift = Math.min(1, (time - state.startTime) / PAIRING_LIFT_MS);
		const scale = state.base.scale + (1 - state.base.scale) * easeOut(lift);
		const x = state.base.x + state.clientX + window.scrollX - state.startPageX;
		const y = state.base.y + state.clientY + window.scrollY - state.startPageY;
		state.element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

		const highlight = this.pairingDropCell(state, state.clientX, state.clientY);
		if (highlight !== state.highlight) {
			state.highlight?.classList.remove("ww-drag-over");
			highlight?.classList.add("ww-drag-over");
			state.highlight = highlight;
		}

		if (scrolled || lift < 1) this.requestPairingAnimationFrame();
	}

	private onPairingPointerDown(event: PointerEvent) {
		if (this.pairingDragState || !this.pairingQuiz || !event.isPrimary || event.button !== 0) return;

		const card = event
			.composedPath()
			.find(target => target instanceof HTMLElement && target.matches("[data-draggable]")) as HTMLElement | undefined;
		if (!card?.dataset.cardId) return;

		event.preventDefault();
		card.setPointerCapture(event.pointerId);

		// Measure before any styles change, so that a card picked up mid-settle stays put.
		const from = card.getBoundingClientRect();
		this.finishPairingSettle();

		// The card grows around the pointer, which keeps the grabbed spot under the cursor.
		const originX = ((event.clientX - from.x) / from.width) * 100;
		const originY = ((event.clientY - from.y) / from.height) * 100;
		card.style.transformOrigin = `${originX}% ${originY}%`;
		card.classList.add("ww-dragging");
		const base = transformTo(card, from) ?? { x: 0, y: 0, scale: 1 };
		card.style.transform = `translate(${base.x}px, ${base.y}px) scale(${base.scale})`;

		const sourceCell = card.closest<HTMLElement>(".pairing-assigned");
		const partner = sourceCell?.querySelector<HTMLElement>(".pairing-card-normal");
		if (sourceCell && partner) {
			const partnerFrom = partner.getBoundingClientRect();
			sourceCell.classList.add("ww-drag-source");
			this.animatePairingCard(partner, partnerFrom, PAIRING_LIFT_MS);
		}

		const scrollingElement = document.scrollingElement ?? document.documentElement;
		const now = performance.now();
		this.pairingDragState = {
			element: card,
			cardId: card.dataset.cardId,
			pointerId: event.pointerId,
			base,
			sourceCell: sourceCell ?? null,
			startPageX: event.pageX,
			startPageY: event.pageY,
			clientX: event.clientX,
			clientY: event.clientY,
			startTime: now,
			lastFrameTime: now,
			frame: null,
			highlight: null,
			maxPageScrollY: Math.max(0, scrollingElement.scrollHeight - scrollingElement.clientHeight),
		};
		this.requestPairingAnimationFrame();
	}

	private onPairingPointerMove(event: PointerEvent) {
		if (event.pointerId !== this.pairingDragState?.pointerId) return;
		event.preventDefault();

		this.pairingDragState.clientX = event.clientX;
		this.pairingDragState.clientY = event.clientY;
		this.requestPairingAnimationFrame();
	}

	private onPairingPointerEnd(event: PointerEvent) {
		const state = this.pairingDragState;
		if (!state || event.pointerId !== state.pointerId) return;
		this.pairingDragState = null;

		if (state.frame !== null) cancelAnimationFrame(state.frame);
		state.highlight?.classList.remove("ww-drag-over");
		if (state.element.hasPointerCapture(event.pointerId)) state.element.releasePointerCapture(event.pointerId);

		const cell = event.type === "pointerup" ? this.pairingDropCell(state, state.clientX, state.clientY) : null;

		// Capture the card where the pointer left it, then let it fly into its cell from there.
		const from = new Map(this.pairingCards.map(card => [card.dataset.cardId!, card.getBoundingClientRect()]));
		state.element.classList.remove("ww-dragging");
		state.sourceCell?.classList.remove("ww-drag-source");
		if (cell) {
			this.applyPairingDrop(state, cell);
			this.requestUpdate("pairingQuiz");
		}
		this.updateComplete.then(() => this.flipPairingCards(from, state.cardId));
	}

	@state()
	private accessor memoryGame: MemoryGameState | null = null;
	private flipBackTimeout?: ReturnType<typeof setTimeout>;

	private resetMemoryGame() {
		if (this.flipBackTimeout !== undefined) clearTimeout(this.flipBackTimeout);
		this.flipBackTimeout = undefined;
		this.memoryGame = {
			itemIds: randomizeArray(this.solution.flat()),
			flippedItemIds: [],
			matchedItemIds: [],
		};
	}

	private flipMemoryItem(id: string) {
		if (this.graded || !this.memoryGame) return;
		const { flippedItemIds, matchedItemIds } = this.memoryGame;
		if (this.flipBackTimeout !== undefined || flippedItemIds.includes(id) || matchedItemIds.includes(id)) return;

		if (flippedItemIds.length === 0) {
			this.memoryGame = { ...this.memoryGame, flippedItemIds: [id] };
			return;
		}

		const firstId = flippedItemIds[0];
		this.memoryGame = { ...this.memoryGame, flippedItemIds: [firstId, id] };
		const isPair = this.solution.some(([a, b]) => (a === firstId && b === id) || (a === id && b === firstId));

		if (isPair) {
			this.memoryGame = {
				...this.memoryGame,
				flippedItemIds: [],
				matchedItemIds: [...matchedItemIds, firstId, id],
			};
			return;
		}

		this.flipBackTimeout = setTimeout(() => {
			this.flipBackTimeout = undefined;
			this.memoryGame = { ...this.memoryGame!, flippedItemIds: [] };
		}, 800);
	}

	private renderMemoryGame() {
		if (!this.memoryGame) return nothing;
		return html`<div class="memory-grid">
			${this.memoryGame.itemIds.map(id => {
				const matched = this.memoryGame!.matchedItemIds.includes(id);
				const flipped = matched || this.memoryGame!.flippedItemIds.includes(id);

				return html`<button
					type="button"
					class=${classMap({ "memory-card": true, flipped, matched })}
					?disabled=${this.graded || matched}
					@click=${() => this.flipMemoryItem(id)}
				>
					<span class="memory-card-inner">
						<span class="memory-card-face memory-card-back">?</span>
						<span class="memory-card-face memory-card-front">
							<slot data-child-id=${id}></slot>
						</span>
					</span>
				</button>`;
			})}
		</div>`;
	}

	/** @internal */
	get dynamicActions() {
		return {
			addPair: { label: { _: msg("Add Pair") } },
		} as Record<string, ActionDeclaration>;
	}

	/** @internal */
	get dynamicOptions() {
		const options: Record<string, OptionDeclaration> = {
			mode: {
				type: "select",
				label: { _: msg("Mode") },
				options: [
					{ value: "pairing", label: { _: msg("Pairing") } },
					{ value: "memory", label: { _: msg("Memory") } },
				],
			},
		};

		return options;
	}

	checkValidity(): boolean {
		return true;
	}

	checkAnswer(detailedFeedback: boolean): number {
		this.graded = true;
		this.detailedFeedback = detailedFeedback;
		if (this.solution.length === 0) return 0;

		if (this.mode === "memory") return (this.memoryGame?.matchedItemIds.length ?? 0) / 2 / this.solution.length;

		const assignments = this.pairingQuiz?.assignments;
		const correct = this.solution.filter(([a, b]) => assignments?.getValue(a) === b);
		return correct.length / this.solution.length;
	}

	reset(): void {
		this.graded = false;
		this.detailedFeedback = false;
		if (this.mode === "memory") this.resetMemoryGame();
		else this.resetPairingQuiz();
	}

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		encryptPlaintextAttributes(this);
	}

	protected updated(changed: PropertyValues): void {
		if (changed.has("solution") && this.solution.length === 0) {
			// Ensure that there is always at least one pair
			this.updateComplete.then(() => this.addPair());
		}

		const children = Array.from(this.children);
		this.slots.forEach(slot => {
			const refId = slot.dataset.childId;
			const item = children.find(child => child.id === refId);
			if (item) slot.assign(item);
		});
	}

	protected willUpdate(changed: PropertyValues<this>): void {
		if (changed.has("solution")) {
			if (this.mode === "pairing") this.resetPairingQuiz();
			else if (this.mode === "memory") this.resetMemoryGame();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.flipBackTimeout !== undefined) clearTimeout(this.flipBackTimeout);
		this.flipBackTimeout = undefined;
		if (this.pairingSettleTimeout !== undefined) clearTimeout(this.pairingSettleTimeout);
		this.pairingSettleTimeout = undefined;
		if (this.pairingDragState?.frame != null) cancelAnimationFrame(this.pairingDragState.frame);
		this.pairingDragState = null;
	}

	render() {
		if (this.isContentEditable) return this.renderAuthoringView();
		if (this.mode === "pairing") return this.renderPairingView();
		if (this.mode === "memory") return this.renderMemoryGame();
		console.warn("[webwriter-pairing] Invalid mode:", this.mode);
		return nothing;
	}
}
