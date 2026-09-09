import { msg } from "@lit/localize";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { LitElementWw, OptionDeclaration } from "@webwriter/lit";
import XIcon from "bootstrap-icons/icons/x.svg";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GapMode } from "./webwriter-gap";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-gap-item": WebwriterGapItem;
	}
}

/**
 * A single gap of a `<webwriter-gap>`, whose content is the correct answer.
 *
 * It must be placed inside the text assigned to the default slot of its parent
 * element.
 */
@customElement("webwriter-gap-item")
export class WebwriterGapItem extends LitElementWw {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		const options: Record<string, OptionDeclaration> = {};
		if (this.mode === "input") {
			options.placeholder = { type: "string", label: { _: msg("Placeholder") } };
		}
		return options;
	}

	/**
	 * Mirrors the mode of the parent gap, which keeps it in sync.
	 * @internal
	 */
	@property({ attribute: false })
	accessor mode: GapMode | undefined = undefined;

	/** @internal */
	@state() accessor answer = "";
	/** @internal */
	@state() accessor inputAnswer = "";
	/** @internal */
	@state() accessor graded = false;
	/** @internal */
	@state() accessor feedback: { correct: boolean; answer: string; solution: string } | null = null;
	/** @internal */
	@state() accessor answerSelected = false;
	/** @internal */
	@state() accessor dropActive = false;

	private slotRef = createRef<HTMLSlotElement>();

	/** @internal */
	static scopedElements = {
		"sl-icon-button": SlIconButton,
		"sl-input": SlInput,
	};

	/**
	 * The placeholder shown while the gap is empty. Only applies in `input` mode.
	 */
	@property({ type: String, attribute: "placeholder", reflect: true })
	accessor placeholder: string = "";

	static styles = css`
		:host {
			--outer-line-height: 2.3;
			--inner-line-height: 2;
			--inner-height: calc(var(--inner-line-height) * 1em);
			display: inline-block !important;
			outline: none !important;
			vertical-align: baseline;
		}

		.container-base {
			height: var(--inner-height);
			line-height: var(--outer-line-height);
			box-sizing: border-box;
			border: 1px solid transparent;
			border-radius: var(--sl-border-radius-medium);
			display: flex;
			align-items: center;
		}

		.container-input {
			background-color: var(--sl-input-background-color);
			border-color: var(--sl-input-border-color);
			padding-left: var(--sl-spacing-x-small);
		}

		.container-placeholder {
			background-color: var(--sl-color-neutral-100);
			position: relative;
			border-color: var(--sl-color-neutral-300);
			min-width: 8em;
			padding: 0 var(--sl-spacing-x-small);
			height: 2em;
			white-space: nowrap;
			font: inherit;
			color: inherit;
			justify-content: center;
			cursor: pointer;
			touch-action: none;
			user-select: none;
		}

		.container-placeholder::before {
			content: "";
			position: absolute;
			inset: -4px;
			border: 2px dotted var(--sl-color-primary-400);
			border-radius: calc(var(--sl-border-radius-medium) + 3px);
			pointer-events: none;
			opacity: 0;
			transition: opacity var(--sl-transition-fast);
			z-index: 2;
		}

		.container-placeholder.active::before {
			opacity: 1;
		}

		@media (prefers-reduced-motion: reduce) {
			.container-placeholder::before { transition: none; }
		}

		.container-placeholder.filled {
			background-color: var(--sl-color-neutral-0);
			min-width: 0;
			width: max-content;
			cursor: grab;
		}

		.feedback {
			padding: 0 var(--sl-spacing-x-small);
			gap: var(--sl-spacing-x-small);
			width: max-content;
		}

		.feedback.correct {
			color: var(--sl-color-success-700);
			background: var(--sl-color-success-50);
			border-color: var(--sl-color-success-600);
		}

		.feedback.incorrect {
			color: var(--sl-color-danger-700);
			background: var(--sl-color-danger-50);
			border-color: var(--sl-color-danger-600);
		}

		.correction { color: var(--sl-color-success-700); }
		.container-placeholder:disabled { cursor: default; }

		sl-input {
			--sl-input-height-medium: var(--inner-height);
			line-height: var(--inner-line-height);
			font: inherit;

			&::part(form-control),
			&::part(form-control-input),
			&::part(base) {
				display: flex;
				align-items: baseline;
			}

			&::part(input),
			&::part(base) {
				font: inherit;
				color: inherit;
			}

			&::part(input) {
				padding: 0 var(--sl-spacing-x-small);
				/* The base paints the rounded background; this control must not cover it. */
				background: transparent;
			}

			&::part(base) {
				vertical-align: baseline;
				overflow: visible;
				letter-spacing: inherit;
			}
		}
	`;

	private renderEditable() {
		return html`<div class="container-base container-input">
			<slot
				${ref(this.slotRef)}
				@slotchange=${(event: Event) => {
					const slot = event.target as HTMLSlotElement;
					if (slot.assignedNodes().length == 0) this.remove();
				}}
			></slot>
			<sl-icon-button
				src=${XIcon}
				@click=${() => {
					const slot = this.slotRef.value;
					if (!slot) return;
					this.replaceWith(...slot.assignedNodes());
				}}
			></sl-icon-button>
		</div>`;
	}

	private renderInput() {
		return html`<sl-input placeholder=${this.placeholder} .value=${this.inputAnswer} ?disabled=${this.graded}
			@sl-input=${(event: Event) => {
				this.inputAnswer = (event.target as SlInput).value;
			}}
		></sl-input>`;
	}

	private renderDragAndDrop() {
		return html`<button
			type="button"
			?disabled=${this.graded}
			class="container-base container-placeholder ${this.dropActive ? "active" : ""} ${this.answer ? "filled" : ""}"
			aria-label=${this.answer || msg("Empty gap")}
			aria-pressed=${this.answerSelected}
			@pointerdown=${(event: PointerEvent) => this.closest("webwriter-gap")?.startGapDrag(event, this)}
			@click=${() => this.closest("webwriter-gap")?.activateGap(this)}
		>
			${this.answer || "\u00a0"}
		</button>`;
	}

	render() {
		if (this.isContentEditable) return this.renderEditable();
		if (this.feedback) {
			const { correct, answer, solution } = this.feedback;
			return html`<span class="container-base feedback ${correct ? "correct" : "incorrect"}" role="status">
				${correct ? answer : html`
					<del aria-label=${msg("Your answer")}>${answer || msg("No answer")}</del>
					<span class="correction" aria-label=${msg("Correct answer")}>${solution}</span>
				`}
			</span>`;
		}
		if (this.mode === "input") return this.renderInput();
		if (this.mode === "drag-and-drop") return this.renderDragAndDrop();

		// An item that is not in a gap yet has no mode, and renders nothing until it is.
		if (this.mode !== undefined) console.warn("[webwriter-gap-item] Unknown mode:", this.mode);
		return nothing;
	}
}
