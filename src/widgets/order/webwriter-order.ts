import { msg } from "@lit/localize";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { action, LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import ArrowDownUpIcon from "bootstrap-icons/icons/arrow-down-up.svg";
import PlusIcon from "bootstrap-icons/icons/plus.svg";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, queryAssignedElements } from "lit/decorators.js";
import LOCALIZE from "../../../localization/generated";
import { name as packageId } from "../../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../../api";
import { DraggableGrid, DraggableGridReorderEvent } from "../../lib/draggable-grid";
import { encryptedProperty, encryptPlaintextAttributes } from "../../lib/encrypted-property";
import { commonStyles, randomizeArray } from "../../lib/utils";
import { mutateWithStableSelection, registerAsEnterCreatesNew } from "../../lib/webwriter-quirks";
import type { WebwriterOrderItem } from "./webwriter-order-item";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-order": WebwriterOrder;
	}
}

export type OrderLayout = "list" | "tiles";
export type OrderDirection = "ascending" | "descending";
export type OrderNumberingStyle = "none" | "numeric" | "alphabetic" | "roman";
export type OrderGradingMethod = "pass-fail" | "partial-position" | "partial-sequence";
export type OrderSolution = string[];

registerQuizType({
	packageId,
	widgetPosition: 20,
	id: "webwriter-order",
	getName: () => msg("Order"),
	icon: ArrowDownUpIcon,
	createInstance: () => document.createElement("webwriter-order"),
});

/**
 * An answer where learners drag items into the correct order.
 *
 * The items must be `<webwriter-order-item>` elements assigned to the default
 * slot.
 */
@customElement("webwriter-order")
export class WebwriterOrder extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"layout": {
				type: "select",
				label: { _: msg("Layout") },
				options: [
					{ value: "list", label: { _: msg("List") } },
					{ value: "tiles", label: { _: msg("Tiles") } },
				],
				description: { _: msg("The layout variant to use.") },
			},
			"direction": {
				type: "select",
				label: { _: msg("Direction") },
				options: [
					{ value: "ascending", label: { _: msg("Ascending") } },
					{ value: "descending", label: { _: msg("Descending") } },
				],
				description: { _: msg("The order direction to use.") },
			},
			"numbering-style": {
				type: "select",
				label: { _: msg("Numbering") },
				options: [
					{ value: "none", label: { _: msg("None") } },
					{ value: "numeric", label: { _: msg("Numeric") } },
					{ value: "alphabetic", label: { _: msg("Alphabetic") } },
					{ value: "roman", label: { _: msg("Roman") } },
				],
				description: { _: msg("The numbering style to use.") },
			},
			"grading-method": {
				type: "select",
				label: { _: msg("Grading") },
				options: [
					{ value: "pass-fail", label: { _: msg("Pass/Fail") } },
					{ value: "partial-position", label: { _: msg("Partial (Position)") } },
					{ value: "partial-sequence", label: { _: msg("Partial (Sequence)") } },
				],
				description: { _: msg("The grading method to use.") },
			},
		};
	}

	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {
		"draggable-grid": DraggableGrid,
		"sl-icon": SlIcon,
	};

	static styles = [
		commonStyles,
		css`
			.container-list {
				display: grid;
				grid-template-columns: max-content max-content minmax(0, 1fr) max-content max-content;
			}

			.container-tiles {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
				gap: var(--sl-spacing-medium);

				.add-option {
					aspect-ratio: 1 / 1;

					border: 1px dashed var(--sl-color-neutral-300);
					border-radius: var(--sl-border-radius-medium);
					box-sizing: border-box;
					color: var(--sl-color-neutral-500);
					cursor: pointer;

					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;

					&:hover {
						background-color: var(--sl-color-primary-50);
						border-color: var(--sl-color-primary-300);
						color: var(--sl-color-primary-700);
					}
				}
			}
		`,
	];

	/**
	 * How the items are arranged.
	 *
	 * - `list`: One item per row.
	 * - `tiles`: A responsive grid of equally sized tiles.
	 */
	@property({ type: String, attribute: "layout", reflect: true })
	accessor layout: OrderLayout = "list";

	/**
	 * The direction in which the items are numbered.
	 *
	 * - `ascending`: The first item carries the lowest position.
	 * - `descending`: The first item carries the highest position.
	 */
	@property({ type: String, attribute: "direction", reflect: true })
	accessor direction: OrderDirection = "ascending";

	/**
	 * How the position of each item is labelled.
	 *
	 * - `none`: No position is shown.
	 * - `numeric`: Arabic numerals (1., 2., 3., ...).
	 * - `alphabetic`: Latin letters (A., B., C., ...).
	 * - `roman`: Roman numerals (I., II., III., ...).
	 */
	@property({ type: String, attribute: "numbering-style", reflect: true })
	accessor numberingStyle: OrderNumberingStyle = "numeric";

	/**
	 * How the score of this answer is calculated.
	 *
	 * - `pass-fail`: Full score only if every item is in its correct position.
	 * - `partial-position`: Credit for each item in its correct position.
	 * - `partial-sequence`: Credit for each pair of adjacent items in the correct order.
	 */
	@property({ type: String, attribute: "grading-method", reflect: true })
	accessor gradingMethod: OrderGradingMethod = "pass-fail";

	/**
	 * The IDs of the items in their correct order. It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: true, reflect: true, converter: encryptedProperty })
	accessor solution: OrderSolution = [];

	/** @internal */
	@queryAssignedElements()
	accessor items!: WebwriterOrderItem[];

	protected updated(changed: PropertyValues): void {
		super.updated(changed);

		if (changed.has("layout") || changed.has("numberingStyle") || changed.has("direction")) {
			this.refreshItems();
		}
	}

	private randomizeItems() {
		this.append(...randomizeArray(this.items));
	}

	checkValidity(): boolean {
		return true;
	}

	reset(): void {
		this.randomizeItems();
	}

	checkAnswer(detailedFeedback: boolean): number {
		// TODO: Show detailed feedback if requested

		switch (this.gradingMethod) {
			case "pass-fail":
				return this.items.every((item, index) => item.id === this.solution[index]) ? 1 : 0;
			case "partial-position":
				const correctPositions = this.items.filter((item, index) => item.id === this.solution[index]).length;
				return correctPositions / this.items.length;
			case "partial-sequence":
				let correctSequenceCount = 0;
				for (let i = 0; i < this.items.length - 1; i++) {
					const currentIndexInSolution = this.solution.indexOf(this.items[i].id);
					const nextIndexInSolution = this.solution.indexOf(this.items[i + 1].id);

					if (currentIndexInSolution + 1 === nextIndexInSolution) correctSequenceCount++;
				}
				return correctSequenceCount / (this.items.length - 1);
			default:
				return 0;
		}
	}

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		encryptPlaintextAttributes(this);
		if (!this.isContentEditable) {
			this.randomizeItems();
		} else {
			this.solution = this.items.map(item => item.id);
		}
	}

	private refreshItems() {
		this.items.forEach(item => item?.requestUpdate?.());
	}

	connectedCallback() {
		super.connectedCallback();
		registerAsEnterCreatesNew("webwriter-order-item");
	}

	private handleReorder({ detail }: DraggableGridReorderEvent) {
		mutateWithStableSelection(detail.item, () => this.insertBefore(detail.item, detail.before));
	}

	@action({ label: { _: msg("Add Option") } })
	private addOption() {
		this.appendChild(document.createElement("webwriter-order-item"));
	}

	private AddOptionButton() {
		if (this.layout !== "tiles" || !this.isContentEditable) return nothing;
		return html`
			<div class="add-option" @click=${this.addOption} id="add-option" data-not-draggable>
				<sl-icon src=${PlusIcon}></sl-icon>
				${msg("Add Option")}
			</div>
		`;
	}

	render() {
		return html`<draggable-grid
			class="container-${this.layout}"
			?vertical=${this.layout === "list"}
			@reorder=${this.handleReorder}
		>
			<slot
				@slotchange=${() => {
					this.refreshItems();
					if (this.isContentEditable) this.solution = this.items.map(item => item.id);
				}}
			></slot>
			${this.AddOptionButton()}
		</draggable-grid>`;
	}
}
