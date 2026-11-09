import type { msg } from "@lit/localize";
import { runtimeMsg } from "@lit/localize/internal/runtime-msg.js";
import { LitElementWw, type ActionDeclaration, type OptionDeclaration } from "@webwriter/lit";
import type { PropertyValues } from "lit";
import { templates as de } from "../../localization/generated/de-DE";
import { templates as es } from "../../localization/generated/es-ES";
import { templates as fr } from "../../localization/generated/fr-FR";
import { templates as it } from "../../localization/generated/it";
import { templates as nl } from "../../localization/generated/nl";

const translations = new Map(Object.entries({ "de-de": de, "es-es": es, "fr-fr": fr, it, nl }));
const fallbacks = new Map(Object.entries({ de, es, fr, it, nl }));

// Reuse Lit's message IDs and template substitution without setting a global locale.
export function messageFor(locale = ""): typeof msg {
	const tag = locale.toLowerCase();
	const templates = translations.get(tag) ?? fallbacks.get(tag.split("-")[0]);
	return runtimeMsg.bind(null, templates) as typeof msg;
}

export class QuizElement extends LitElementWw {
	// The published base declares these as fields, although the drawer supports getters.
	// @ts-expect-error The base field is type-only and does not define an instance value.
	get options(): Record<string, OptionDeclaration> { return {}; }
	// @ts-expect-error The base field is type-only and does not define an instance value.
	get actions(): Record<string, ActionDeclaration & { group?: string }> { return {}; }

	get lang(): string {
		let element: Element = this;
		while (true) {
			const language = element.closest("[lang]");
			if (language) return language.getAttribute("lang") ?? "";
			const root = element.getRootNode();
			if (!(root instanceof ShadowRoot)) return "";
			element = root.host;
		}
	}

	set lang(value: string) {
		super.lang = value;
	}

	protected get msg() {
		return messageFor(this.lang);
	}

	protected updated(changed: PropertyValues) {
		super.updated(changed);
		if (changed.has("lang") || changed.has("editable")) this.refreshDrawer();
	}

	protected refreshDrawer() {
		this.dispatchEvent(new Event("optionschange", { bubbles: true }));
	}
}
