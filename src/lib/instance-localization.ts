import type { LocaleModule, MsgFn, TemplateMap } from "@lit/localize";
import { runtimeMsg } from "@lit/localize/internal/runtime-msg.js";
import type { LitElement } from "lit";
// @ts-ignore The Lit localization CLI emits the locale index as JavaScript.
import { sourceLocale, targetLocales } from "../../localization/generated/locale-codes.js";

const supported = new Map([sourceLocale, ...targetLocales].map(locale => [locale.toLowerCase(), locale]));
const regionalDefaults: Record<string, string> = {
  bn: "bn-BD", de: "de-DE", es: "es-ES", fa: "fa-IR", fr: "fr-FR",
  no: "nb", pt: "pt-PT",
};

export function parseLocale(language: string | null | undefined): Intl.Locale {
  try {
    return new Intl.Locale(language?.trim() || sourceLocale);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.Locale(sourceLocale);
  }
}

function resolveLocale(language: string): string {
  const locale = parseLocale(language);
  const { language: base, script, region } = locale.maximize();
  const localeScript = script === "Aran" ? "Arab" : script;
  const exact = supported.get(locale.baseName.toLowerCase());
  if (exact) return exact;
  const fallback = supported.get(regionalDefaults[base]?.toLowerCase());
  if (locale.baseName === base && fallback) return fallback;
  return supported.get(`${base}-${localeScript}`.toLowerCase()) ??
    supported.get(`${base}-${region}`.toLowerCase()) ??
    supported.get(base) ??
    fallback ??
    sourceLocale;
}

function languageAncestors(element: Element) {
  const ancestors = [];
  for (let node: Element | null = element; node;) {
    ancestors.push(node);
    const root = node.getRootNode();
    node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return ancestors;
}

export function effectiveLanguage(element: Element): string {
  return languageAncestors(element).find(node => node.hasAttribute("lang"))?.getAttribute("lang") ?? "";
}

export function localizeElement(host: LitElement) {
  let language: string | undefined;
  let locale: string = sourceLocale;
  let templates: TemplateMap | undefined;
  let revision = 0;

  async function update() {
    const nextLanguage = effectiveLanguage(host);
    if (language === nextLanguage) return;
    language = nextLanguage;
    const request = ++revision;
    let nextLocale = resolveLocale(language);
    if (nextLocale !== locale) {
      let module: LocaleModule | undefined;
      try {
        module = nextLocale === sourceLocale
          ? undefined : await import(`../../localization/generated/${nextLocale}.ts`);
      } catch (error) {
        if (request !== revision) return;
        nextLocale = sourceLocale;
        host.dispatchEvent(new CustomEvent("localizationerror", { detail: { error } }));
      }
      if (request !== revision) return;
      templates = module?.templates;
      locale = nextLocale;
    }
    // The legacy LitElementWw property reflects lang, while this update
    // represents an inherited value and must stay out of the authored DOM.
    host.requestUpdate("lang", undefined, { reflect: false });
    host.dispatchEvent(new Event("optionschange", { bubbles: true }));
  }

  const observer = new MutationObserver(() => void update());
  host.addController({
    hostConnected() {
      for (const node of languageAncestors(host)) {
        observer.observe(node, { attributes: true, attributeFilter: ["lang"] });
      }
      void update();
    },
    hostDisconnected() {
      observer.disconnect();
      language = undefined;
      revision++;
    },
  });

  return {
    msg: ((template, options) => runtimeMsg(templates, template, options)) as MsgFn,
    getLanguage: () => language ?? "",
  };
}
