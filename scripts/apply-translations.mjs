#!/usr/bin/env node
/**
 * Merges translations from JSON into the XLIFF interchange files.
 *
 * Usage: node scripts/apply-translations.mjs <dir>
 *
 * Expects <dir> to contain `translations-<locale>.json` files, each mapping
 * trans-unit id -> translated string, for the locales in lit-localize.json.
 * Only fills targets that are missing or empty; existing targets are left
 * alone, so hand-corrected translations survive a re-run.
 *
 * Run `npx @lit/localize-tools extract` before this, and
 * `npx @lit/localize-tools build` after.
 */

import { promises as fs } from "fs";
import { join } from "path";

const XML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeXml = text => text.replace(/[&<>]/g, c => XML_ESCAPES[c]);

/** Placeholders are `<x id="0" equiv-text="${...}"/>` in the source; translators write them back as `${...}`. */
function encodeTarget(source, translation) {
	const placeholders = [...source.matchAll(/<x id="(\d+)" equiv-text="([^"]*)"\/>/g)];
	let target = escapeXml(translation);
	for (const [, id, equivText] of placeholders) {
		// Tolerate a placeholder wrapped in braces (`{${x}}`) — a common way for the
		// interpolation to come back doubled — before checking it is present at all.
		target = target.replaceAll(`{${equivText}}`, () => equivText);
		// equiv-text is already XML-escaped in the source; compare against the escaped translation
		if (!target.includes(equivText)) {
			throw new Error(`missing placeholder ${equivText} in translation ${JSON.stringify(translation)}`);
		}
		// function replacement: `$` in the placeholder must not be read as a substitution pattern
		target = target.replace(equivText, () => `<x id="${id}" equiv-text="${equivText}"/>`);
	}
	if (placeholders.length && /[{}]/.test(target.replace(/<x [^>]*\/>/g, ""))) {
		throw new Error(`stray brace left around placeholder in ${JSON.stringify(translation)}`);
	}
	return target;
}

async function applyLocale(xliffDir, locale, translations) {
	const path = join(xliffDir, `${locale}.xlf`);
	const xliff = await fs.readFile(path, "utf8");
	let filled = 0;
	let skipped = 0;
	const missing = [];

	const updated = xliff.replace(/<trans-unit id="([^"]+)">([\s\S]*?)<\/trans-unit>/g, (unit, id, body) => {
		const translation = translations[id];
		if (translation === undefined) {
			missing.push(id);
			return unit;
		}
		if (/<target[ >]/.test(body)) {
			skipped++;
			return unit;
		}
		const source = body.match(/<source>([\s\S]*?)<\/source>/)?.[1] ?? "";
		const target = encodeTarget(source, translation);
		filled++;
		return unit.replace(/(<source>[\s\S]*?<\/source>)/, `$1\n  <target>${target}</target>`);
	});

	await fs.writeFile(path, updated, "utf8");
	return { filled, skipped, missing };
}

const dir = process.argv[2];
if (!dir) {
	console.error("usage: node scripts/apply-translations.mjs <dir-with-translations-*.json>");
	process.exit(1);
}

const { targetLocales, interchange } = JSON.parse(await fs.readFile("./lit-localize.json", "utf8"));
let failed = false;

for (const locale of targetLocales) {
	const jsonPath = join(dir, `translations-${locale}.json`);
	let translations;
	try {
		translations = JSON.parse(await fs.readFile(jsonPath, "utf8"));
	} catch {
		console.error(`${locale}: no ${jsonPath}, skipping`);
		failed = true;
		continue;
	}
	const { filled, skipped, missing } = await applyLocale(interchange.xliffDir, locale, translations);
	console.log(`${locale}: filled ${filled}, kept ${skipped} existing, ${missing.length} untranslated`);
	if (missing.length) {
		console.error(`  missing ids: ${missing.join(", ")}`);
		failed = true;
	}
}

process.exit(failed ? 1 : 0);
