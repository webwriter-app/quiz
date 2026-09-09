import { msg } from "@lit/localize";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import GripHorizontalIcon from "../../../assets/icons/grip-horizontal.svg";
import GripVerticalIcon from "../../../assets/icons/grip-vertical.svg";
import { DraggableGridItem } from "../../lib/draggable-grid";
import { HintPopup } from "../../lib/hint-popup";
import { commonStyles } from "../../lib/utils";
import type { WebwriterChoice } from "./webwriter-choice";

/**
 * A single option of a `<webwriter-choice>`.
 *
 * It must be assigned to the default slot of its parent element. An optional
 * `<webwriter-quiz-hint>` may be assigned to its `hint` slot.
 */
@customElement("webwriter-choice-item")
export class WebwriterChoiceItem extends LitElementWw implements DraggableGridItem {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"feedback-selected": { type: "string", label: { _: msg("Feedback if selected") } },
			"feedback-not-selected": { type: "string", label: { _: msg("Feedback if not selected") } },
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-icon": SlIcon,
		"sl-icon-button": SlIconButton,
		"hint-popup": HintPopup,
	};

	/** @internal */
	get draggableElement() {
		return this.shadowRoot?.querySelector(".choice-item") as HTMLElement;
	}

	static styles = [
		commonStyles,
		css`
			:host {
				display: contents !important;
			}

			.marker {
				/* Mimics the appearance of Shoelace's checkbox and radio inputs as closely as possible */
				width: 1.125em;
				height: 1.125em;
				box-sizing: border-box;

				padding: 0;
				display: grid;
				place-items: center;

				font: inherit;
				border: solid var(--sl-input-border-width) var(--color-border);
				color: var(--sl-color-neutral-0);
				background-color: var(--color-marker);
				transition:
					var(--sl-transition-fast) border-color,
					var(--sl-transition-fast) background-color;
				cursor: inherit;

				.mode-single & {
					border-radius: var(--sl-border-radius-circle);
				}

				.mode-multiple & {
					border-radius: var(--sl-border-radius-small);
				}
			}

			.choice-item {
				background-color: var(--sl-color-neutral-0);
				--color-border: var(--sl-input-border-color);
				--color-marker: var(--sl-input-background-color);
				--color-background: var(--sl-color-neutral-0);

				&.selected {
					--color-border: var(--sl-color-primary-600);
					--color-marker: var(--sl-color-primary-600);
					--color-background: var(--sl-color-primary-50);
				}

				&.feedback {
					&.correct.selected {
						--color-border: var(--sl-color-success-600);
						--color-marker: var(--sl-color-success-600);
						--color-background: var(--sl-color-success-50);
					}

					&:not(.correct):not(.selected) {
						--color-border: var(--sl-color-warning-600);
						--color-marker: var(--sl-color-warning-50);
						--color-background: var(--sl-color-warning-50);

						.marker sl-icon {
							display: none;
						}
					}

					&:not(.correct).selected {
						--color-border: var(--sl-color-danger-600);
						--color-marker: var(--sl-color-danger-600);
						--color-background: var(--sl-color-danger-50);
					}
				}
			}

			.active .marker-container,
			:host(:not([contenteditable="true"]):not([contenteditable=""])) .active {
				cursor: pointer;

				&:hover {
					--color-border: var(--sl-input-border-color-hover);
					--color-marker: var(--sl-input-background-color-hover);

					.selected &,
					&.selected {
						--color-border: var(--sl-color-primary-500);
						--color-marker: var(--sl-color-primary-500);
					}
				}
			}

			slot {
				display: block;
			}

			.feedback-message {
				color: var(--sl-color-neutral-500);
				font-size: var(--sl-font-size-small);
			}

			.actions {
				height: 1lh;
				display: flex;
				align-items: center;
				opacity: 0;

				.drag-handle {
					cursor: grab;
					touch-action: none;
				}

				sl-icon-button::part(base) {
					padding: 0.25em;
				}
			}

			hint-popup::part(empty) {
				opacity: 0;
			}

			:is(.ww-dragging, :host(:hover)) .actions {
				opacity: 1;
			}

			:is(.ww-dragging, :host(.ww-selected-text-within), :host(:hover)) hint-popup::part(empty) {
				opacity: 1;
			}

			.layout-list {
				display: grid !important;
				grid-column: 1 / -1;
				grid-template-columns: subgrid;

				> * {
					padding: var(--sl-spacing-2x-small) 0;
				}

				.marker-container {
					height: 1lh;
					padding-right: var(--sl-spacing-small);

					display: flex;
					align-items: center;
				}
			}

			.layout-tiles {
				border: 1px solid var(--sl-input-border-color);
				border-radius: var(--sl-border-radius-large);
				padding: var(--sl-spacing-small);
				box-sizing: border-box;

				display: grid !important;
				grid-template-columns: auto 1fr auto;
				grid-template-rows: auto 1fr;
				grid-template-areas: "marker . hint" "content content content";
				position: relative;
				aspect-ratio: 1 / 1;

				:host(:not([contenteditable="true"]):not([contenteditable=""])) & {
					border-color: var(--color-border);
					background-color: var(--color-background);
					transition:
						var(--sl-transition-fast) border-color,
						var(--sl-transition-fast) background-color;
				}

				.marker-container {
					grid-area: marker;
				}

				hint-popup {
					grid-area: hint;
					translate: var(--sl-spacing-2x-small), var(--sl-spacing-2x-small);
				}

				.content {
					grid-area: content;
				}

				.actions {
					position: absolute;
					background: var(--sl-color-neutral-0);
					border: 1px solid var(--sl-input-border-color);
					border-radius: var(--sl-border-radius-pill);
					top: 0;
					left: 50%;
					translate: -50% -50%;
					padding: 0 var(--sl-spacing-x-small);
					box-sizing: border-box;
				}
			}
		`,
	];

	/**
	 * The feedback shown after submitting if learners selected this option.
	 */
	@property({ type: String, attribute: "feedback-selected", reflect: true })
	accessor feedbackSelected: string = "";

	/**
	 * The feedback shown after submitting if learners did not select this option.
	 */
	@property({ type: String, attribute: "feedback-not-selected", reflect: true })
	accessor feedbackNotSelected: string = "";

	private dispatchSelectEvent() {
		/** @internal */
		this.dispatchEvent(new CustomEvent("select", { detail: { id: this.id }, bubbles: true }));
	}

	private handleClick() {
		if (!this.isContentEditable) this.dispatchSelectEvent();
	}

	connectedCallback(): void {
		super.connectedCallback();
		this.addEventListener("click", this.handleClick);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener("click", this.handleClick);
	}

	render() {
		const parent = this.parentElement as WebwriterChoice | undefined;
		if (!parent) return nothing;
		const state = parent.getChoiceState(this.id);

		return html`
			<div
				class=${classMap({
					"choice-item": true,
					[`mode-${parent.mode}`]: true,
					[`layout-${parent.layout}`]: true,
					selected: state.selected,
					active: !state.disabled,
					feedback: state.showFeedback,
					correct: state.showFeedback && state.correct,
				})}
			>
				<div class="marker-container" @click=${() => this.isContentEditable && this.dispatchSelectEvent()}>
					<button
						class=${classMap({
							marker: true,
							correct: state.correct,
						})}
						?disabled=${state.disabled}
					>
						<sl-icon library="system" name=${parent.mode === "multiple" ? "check" : "radio"}></sl-icon>
					</button>
				</div>

				<div class="content">
					<slot style="--ww-placeholder: '${"Option"}'"></slot>
					${state.showFeedback
						? html`<div class="feedback-message">
								${state?.correct ? this.feedbackSelected : this.feedbackNotSelected}
							</div> `
						: nothing}
				</div>

				<div class="actions author-only">
					<sl-icon-button
						class="drag-handle"
						data-drag-handle
						src=${parent.layout === "list" ? GripVerticalIcon : GripHorizontalIcon}
					></sl-icon-button>
				</div>

				<hint-popup position="start"><slot name="hint"></slot></hint-popup>
			</div>
		`;
	}
}
