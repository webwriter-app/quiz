import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlPopup from "@shoelace-style/shoelace/dist/components/popup/popup.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw } from "@webwriter/lit";
import IconQuestionCircleFill from "bootstrap-icons/icons/question-circle-fill.svg";
import IconQuestionCircle from "bootstrap-icons/icons/question-circle.svg";
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";

/**
 * A reusable popup with a "?" trigger that manages a `<webwriter-quiz-hint>`
 * element on its host.
 *
 * Use it inside your widget like this:
 * <hint-popup>
 *   <slot name="hint"></slot>
 * </hint-popup>
 *
 * Make sure to include `webwriter-quiz-hint?` in your widget's content property.
 */
export class HintPopup extends LitElementWw {
	static readonly CONTENT_TAG = "webwriter-quiz-hint";

	static scopedElements = {
		"sl-icon-button": SlIconButton,
		"sl-popup": SlPopup,
	};

	static styles = css`
		:host {
			display: inline-block;
			height: 1.5em;
		}

		sl-icon-button::part(base) {
			padding: var(--sl-spacing-2x-small);
		}

		sl-popup {
			--arrow-color: var(--sl-color-neutral-700);

			&::part(popup) {
				padding: var(--sl-spacing-x-small);
				max-width: min(20rem, 100cqi, var(--auto-size-available-width, 20rem));
				overflow-wrap: anywhere;
				background: var(--sl-color-neutral-700);
				border-radius: var(--sl-border-radius-medium);
				color: var(--sl-color-neutral-0);
				font-size: var(--sl-font-size-small);
			}
		}
	`;

	@property({ type: String, attribute: "slot-name", reflect: true })
	accessor slotName = "hint";

	@property({ type: String, attribute: "position", reflect: true })
	accessor position: "start" | "end" = "end";

	@state()
	private accessor open = false;

	private get host(): HTMLElement | null {
		const root = this.getRootNode();
		if (root instanceof ShadowRoot) {
			return root.host as HTMLElement;
		}
		return this.parentElement;
	}

	private get hostContentEls(): HTMLElement[] {
		const host = this.host;
		if (!host || !this.slotName) return [];
		return Array.from(host.querySelectorAll<HTMLElement>(`:scope > [slot="${this.slotName}"]`));
	}

	private get hasContent(): boolean {
		return this.hostContentEls.some(el => el.innerText.trim() !== "");
	}

	private insertHintElement(host: HTMLElement): HTMLElement {
		const el = host.ownerDocument.createElement(HintPopup.CONTENT_TAG);
		el.slot = this.slotName;

		if (this.position === "start") {
			host.prepend(el);
		} else {
			host.append(el);
		}

		return el;
	}

	private toggle() {
		this.open = !this.open;
		const host = this.host;
		if (!host) return;

		if (host.isContentEditable && this.open && !this.hostContentEls.length) this.insertHintElement(host);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.open = false;
	}

	render() {
		if (this.host && !this.host.isContentEditable && !this.hasContent) return nothing;

		return html`<sl-popup
			?active=${this.open}
			placement="bottom-end"
			arrow
			flip
			auto-size
			shift
			distance="5"
			@selectstart=${(e: Event) => e.stopImmediatePropagation()}
		>
			<sl-icon-button
				part=${this.hasContent || this.open ? "filled" : "empty"}
				slot="anchor"
				src=${this.hasContent || this.open ? IconQuestionCircleFill : IconQuestionCircle}
				@click=${() => this.toggle()}
			></sl-icon-button>
			<slot @slotchange=${() => this.requestUpdate()}></slot>
		</sl-popup>`;
	}
}
