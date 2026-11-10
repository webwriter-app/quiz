import { type OptionDeclaration } from "@webwriter/lit";
import ArrowDownUpIcon from "bootstrap-icons/icons/arrow-down-up.svg";
import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { name as packageId } from "../../../package.json";
import { registerQuizType } from "../../api";
import { DraggableGrid, DraggableGridReorderEvent } from "../../lib/draggable-grid";
import { encryptedProperty, encryptPlaintextAttributes } from "../../lib/encrypted-property";
import { QuizItems } from "../../lib/quiz-items";
import { commonStyles } from "../../lib/utils";
import { mutateWithStableSelection } from "../../lib/webwriter-quirks";
import type { WebwriterOrderItem } from "./webwriter-order-item";
import { messageFor } from "../../lib/localization";
import { WebwriterTask } from "../webwriter-task";

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
	getName: (locale, translate = messageFor(locale)) => translate("Order"),
	icon: ArrowDownUpIcon,
	createInstance: () => {
		const task = document.createElement("webwriter-order");
		const item = document.createElement("webwriter-order-item");
		item.append(document.createElement("p"));
		task.append(item);
		return task;
	},
});

/**
 * An answer where learners drag items into the correct order.
 *
 * The items must be `<webwriter-order-item>` elements assigned to the default
 * slot.
 */
@customElement("webwriter-order")
export class WebwriterOrder extends WebwriterTask {
	static shadowRootOptions: ShadowRootInit = { ...WebwriterTask.shadowRootOptions, slotAssignment: "manual" };

	/** @internal */
	get actions() {
		return {
			...super.actions,
			addOption: { label: { _: this.msg("Add Option") } },
		};
	}

	/** @internal */
	get options(): Record<string, OptionDeclaration> {
		return {
			...super.options,
			"layout": {
				type: "select",
				label: { _: this.msg("Layout") },
				options: [
					{ value: "list", label: { _: this.msg("List") } },
					{ value: "tiles", label: { _: this.msg("Tiles") } },
				],
				description: { _: this.msg("The layout variant to use.") },
			},
			"direction": {
				type: "select",
				label: { _: this.msg("Direction") },
				options: [
					{ value: "ascending", label: { _: this.msg("Ascending") } },
					{ value: "descending", label: { _: this.msg("Descending") } },
				],
				description: { _: this.msg("The order direction to use.") },
			},
			numberingStyle: {
				type: "select",
				label: { _: this.msg("Numbering") },
				options: [
					{ value: "none", label: { _: this.msg("None") } },
					{ value: "numeric", label: { _: this.msg("Numeric") } },
					{ value: "alphabetic", label: { _: this.msg("Alphabetic") } },
					{ value: "roman", label: { _: this.msg("Roman") } },
				],
				description: { _: this.msg("The numbering style to use.") },
			},
			gradingMethod: {
				type: "select",
				label: { _: this.msg("Grading") },
				options: [
					{ value: "pass-fail", label: { _: this.msg("Pass/Fail") } },
					{ value: "partial-position", label: { _: this.msg("Partial (Position)") } },
					{ value: "partial-sequence", label: { _: this.msg("Partial (Sequence)") } },
				],
				description: { _: this.msg("The grading method to use.") },
			},
		};
	}

	/** @internal */
	static scopedElements = {
		...WebwriterTask.scopedElements,
		"draggable-grid": DraggableGrid,
	};

	static styles = [
		WebwriterTask.styles,
		commonStyles,
		css`
			.container-list {
				display: grid;
				grid-template-columns: max-content max-content minmax(0, 1fr) max-content max-content;
			}

			.container-tiles {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(min(130px, 100%), 1fr));
				gap: var(--sl-spacing-medium);
			}
		`,
	];

	/**
	 * How the items are arranged.
	 *
	 * - `list`: One item per row.
	 * - `tiles`: A responsive grid of equally sized tiles.
	 */
	@property({ type: String, attribute: "layout", reflect: true, useDefault: true })
	accessor layout: OrderLayout = "list";

	/**
	 * The direction in which the items are numbered.
	 *
	 * - `ascending`: The first item carries the lowest position.
	 * - `descending`: The first item carries the highest position.
	 */
	@property({ type: String, attribute: "direction", reflect: true, useDefault: true })
	accessor direction: OrderDirection = "ascending";

	/**
	 * How the position of each item is labelled.
	 *
	 * - `none`: No position is shown.
	 * - `numeric`: Arabic numerals (1., 2., 3., ...).
	 * - `alphabetic`: Latin letters (A., B., C., ...).
	 * - `roman`: Roman numerals (I., II., III., ...).
	 */
	@property({ type: String, attribute: "numbering-style", reflect: true, useDefault: true })
	accessor numberingStyle: OrderNumberingStyle = "numeric";

	/**
	 * How the score of this answer is calculated.
	 *
	 * - `pass-fail`: Full score only if every item is in its correct position.
	 * - `partial-position`: Credit for each item in its correct position.
	 * - `partial-sequence`: Credit for each pair of adjacent items in the correct order.
	 */
	@property({ type: String, attribute: "grading-method", reflect: true, useDefault: true })
	accessor gradingMethod: OrderGradingMethod = "pass-fail";

	/**
	 * The IDs of the items in their correct order. It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: true, reflect: true, useDefault: true, converter: encryptedProperty })
	accessor solution: OrderSolution = [];

	private orderItems = new QuizItems<WebwriterOrderItem>(this, "webwriter-order-item", () => true);

		/** @internal */
		get items() {
			return this.orderItems.ordered;
		}

	protected updated(changed: PropertyValues): void {
		super.updated(changed);

		if (changed.has("layout") || changed.has("numberingStyle") || changed.has("direction") || changed.has("editable")) {
			this.refreshItems();
		}
	}

	checkValidity(): boolean {
		return true;
	}

	reset(): void {
		this.orderItems.shuffle();
	}

	checkAnswer(detailedFeedback: boolean): number {
		const order = this.items.map(item => item.id);
		const solution = this.solution.length || this.hasAttribute("solution")
			? this.solution
			: this.orderItems.authored.map(item => item.id);
		if (!order.length) return 0;
		const matches = order.filter((id, index) => id === solution[index]).length;

		switch (this.gradingMethod) {
			case "pass-fail":
				return matches === order.length ? 1 : 0;
			case "partial-position":
				return matches / order.length;
			case "partial-sequence": {
				if (order.length === 1) return matches;
				const adjacentMatches = order.slice(0, -1).filter((id, index) => {
					const position = solution.indexOf(id);
					return position !== -1 && solution[position + 1] === order[index + 1];
				}).length;
				return adjacentMatches / (order.length - 1);
			}
			default:
				return 0;
		}
	}

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		if (this.editable) encryptPlaintextAttributes(this);
	}

	private refreshItems() {
		this.items.forEach(item => item?.requestUpdate?.());
	}

	private handleReorder({ detail }: DraggableGridReorderEvent) {
		if (!this.editable) {
			this.orderItems.move(detail.item, detail.before);
			return;
		}
		const items = this.orderItems.authored;
		if (!items.includes(detail.item as WebwriterOrderItem) ||
			(detail.before && !items.includes(detail.before as WebwriterOrderItem))) return;
		mutateWithStableSelection(detail.item, () => {
			this.insertBefore(detail.item, detail.before ?? this.feedbackElement);
			this.solution = this.orderItems.authored.map(item => item.id);
		});
	}

	protected addOption() {
		if (!this.isConnected || !this.editable) return;
		const item = this.ownerDocument.createElement("webwriter-order-item");
		item.id = "ww" + crypto.randomUUID();
		item.append(this.ownerDocument.createElement("p"));
		this.insertBefore(item, this.feedbackElement);
		if (this.hasAttribute("solution")) this.solution = [...this.solution, item.id];
	}

	protected renderAnswer() {
		return html`<draggable-grid
			class="container-${this.layout}"
			?vertical=${this.layout === "list"}
			@reorder=${this.handleReorder}
		>
			<slot @slotchange=${this.refreshItems}></slot>
		</draggable-grid>`;
	}
}
