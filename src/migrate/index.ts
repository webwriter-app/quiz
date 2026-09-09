/**
 * Migrates quiz content authored with `@webwriter/quiz` v1 to the v2 element
 * set. WebWriter loads this script into an offscreen iframe before parsing a
 * document and dispatches a `migrate` event on every outdated widget, innermost
 * first, so each handler can assume its own children were already migrated.
 *
 * The dispatching document is snapshotted as soon as the iframe fires `load`,
 * which means everything here has to run synchronously — see
 * `./legacy-solution` for why the v1 solution crypto is reimplemented by
 * hand instead of using `crypto.subtle`.
 */

import { name as packageName, version as packageVersion } from "../../package.json";
import { encryptedProperty } from "../lib/encrypted-property";
import { decryptLegacySolution } from "./legacy-solution";

/** Documents written by this major version (or newer) are left alone. */
const CURRENT_MAJOR_VERSION = Number(packageVersion.split(".")[0]);

/** Tags that can act as the answer of a `<webwriter-task>` after migration. */
const ANSWER_TAGS = new Set([
	"webwriter-choice",
	"webwriter-true-false",
	"webwriter-order",
	"webwriter-text",
	"webwriter-mark",
	"webwriter-gap",
	"webwriter-pairing",
	"webwriter-speech",
]);

/** Quizzes this script created to host tasks that used to stand on their own. */
const generatedQuizzes = new WeakSet<Element>();

/** Clozes whose gaps offered a list of options, which v2 models as drag and drop. */
const dragAndDropClozes = new WeakSet<Element>();

/** Decrypted v1 task solutions, since decryption costs ~150ms per task. */
const taskSolutions = new WeakMap<Element, unknown>();

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function warn(message: string, ...details: unknown[]) {
	console.warn(`[${packageName}] ${message}`, ...details);
}

function uniqueId() {
	const uuid = crypto.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
	return `ww-${uuid}`;
}

/** Marks `el` as belonging to the current version of this package. */
function markAsCurrent(el: Element) {
	for (const cls of Array.from(el.classList)) {
		if (cls.startsWith("ww-v")) el.classList.remove(cls);
	}
	el.classList.add("ww-widget", `ww-v${packageVersion}`, `ww-pkg-${packageName}`);
	if (!el.id) el.id = uniqueId();
}

function createWidget(tag: string, id?: string) {
	const el = document.createElement(tag);
	if (id) el.id = id;
	markAsCurrent(el);
	return el;
}

/** Replaces `el` with an equivalent `tag` element, keeping its id, attributes and children. */
function retag(el: Element, tag: string) {
	const replacement = document.createElement(tag);
	for (const name of el.getAttributeNames()) replacement.setAttribute(name, el.getAttribute(name)!);
	replacement.append(...Array.from(el.childNodes));
	markAsCurrent(replacement);
	el.replaceWith(replacement);
	return replacement;
}

function removeAttributes(el: Element, ...names: string[]) {
	for (const name of names) el.removeAttribute(name);
}

function renameAttribute(el: Element, from: string, to: string) {
	if (!el.hasAttribute(from)) return;
	el.setAttribute(to, el.getAttribute(from)!);
	el.removeAttribute(from);
}

function parseJson(value: string | null): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

/**
 * Writes a solution the way v2 expects it. The value is obfuscated with the
 * same converter the widgets use, so it never lands in the document as
 * readable text.
 */
function setSolution(el: Element, value: unknown) {
	const attribute = encryptedProperty.toAttribute?.(value, Array);
	if (typeof attribute === "string") el.setAttribute("solution", attribute);
}

/**
 * Reads the solution of the `<webwriter-task>` containing `el`. v1 stored the
 * answer element's solution on the task, encrypted with a hardcoded password.
 */
function getTaskSolution(el: Element): unknown {
	const task = el.closest("webwriter-task");
	if (!task) return undefined;
	if (taskSolutions.has(task)) return taskSolutions.get(task);

	const solution = task.getAttribute("solution");
	const iv = task.getAttribute("iv");
	const salt = task.getAttribute("salt");
	let value: unknown = undefined;

	if (solution && iv && salt) {
		try {
			value = decryptLegacySolution(solution, iv, salt);
		} catch (error) {
			warn("Could not decrypt the solution of a task, it will have to be entered again.", task, error);
		}
	}

	taskSolutions.set(task, value);
	return value;
}

// ---------------------------------------------------------------------------
// Quiz, task and prompt
// ---------------------------------------------------------------------------

function migrateQuiz(el: Element) {
	// v2 has neither randomized task order nor task counters.
	removeAttributes(el, "randomorder", "counter", "submitted");
	markAsCurrent(el);
}

/** Returns the task's prompt, creating one if the task somehow lost it. */
function ensurePrompt(task: Element) {
	let prompt = task.querySelector(":scope > webwriter-task-prompt");
	if (!prompt) {
		prompt = createWidget("webwriter-task-prompt");
		prompt.appendChild(document.createElement("p"));
		task.insertBefore(prompt, task.firstChild);
	}
	prompt.setAttribute("slot", "prompt");
	return prompt;
}

/**
 * v1 tasks carried their own submit button, so they were usable on their own.
 * In v2 grading lives on the quiz, so standalone tasks need a quiz around them.
 * Consecutive tasks are collected into a single quiz.
 */
function ensureQuiz(task: Element) {
	const parent = task.parentElement;
	if (!parent || parent.localName === "webwriter-quiz") return;

	const previous = task.previousElementSibling;
	if (previous && generatedQuizzes.has(previous)) {
		previous.appendChild(task);
		return;
	}

	const quiz = createWidget("webwriter-quiz");
	generatedQuizzes.add(quiz);
	parent.insertBefore(quiz, task);
	quiz.appendChild(task);
}

function migrateTask(el: Element) {
	const solution = getTaskSolution(el);
	removeAttributes(el, "solution", "iv", "salt", "hint", "submitted", "counter");
	applyAnswerSolution(el, solution);
	ensurePrompt(el);
	markAsCurrent(el);
	ensureQuiz(el);
}

function migratePrompt(el: Element) {
	el.setAttribute("slot", "prompt");
	markAsCurrent(el);
}

/** Elements that cannot survive inside the `p+` content of a hint. */
const BLOCK_TAGS = new Set(["div", "section", "article", "ul", "ol", "li", "blockquote", "pre", "figure"]);

/**
 * Appends `nodes` to `target` as paragraphs, since `<webwriter-quiz-hint>`
 * accepts `p+` while v1 hints and explainers accepted arbitrary flow content.
 */
function appendAsParagraphs(target: Element, nodes: Node[]) {
	let paragraph: HTMLParagraphElement | undefined;

	for (const node of nodes) {
		const tag = node.nodeType === Node.ELEMENT_NODE ? (node as Element).localName : undefined;

		if (tag === "p") {
			target.appendChild(node);
			paragraph = undefined;
		} else if (tag && (BLOCK_TAGS.has(tag) || /^h[1-6]$/.test(tag))) {
			const replacement = document.createElement("p");
			replacement.append(...Array.from(node.childNodes));
			target.appendChild(replacement);
			paragraph = undefined;
		} else if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim()) {
			if (!paragraph) {
				paragraph = document.createElement("p");
				target.appendChild(paragraph);
			}
			paragraph.appendChild(node);
		}
	}
}

/**
 * Returns the task's single `<webwriter-quiz-hint>`, creating it if needed. The
 * prompt slots it by name and expects it first, see `webwriter-task-prompt` in
 * `editing-config.json` and `hint-popup`.
 */
function ensureHint(task: Element, id?: string) {
	const prompt = ensurePrompt(task);
	let hint = prompt.querySelector(":scope > webwriter-quiz-hint");

	if (!hint) {
		hint = createWidget("webwriter-quiz-hint", id);
		hint.setAttribute("slot", "hint");
		prompt.prepend(hint);
	}

	return hint;
}

/**
 * Folds a v1 `<webwriter-task-hint>` or `<webwriter-task-explainer>` into the
 * task's hint. v1 allowed one hint plus any number of explainers per task,
 * while v2 has a single hint, so their contents are concatenated in document
 * order.
 */
function foldIntoHint(el: Element, id?: string) {
	const task = el.closest("webwriter-task");

	if (task) {
		appendAsParagraphs(ensureHint(task, id), Array.from(el.childNodes));
	} else {
		warn("Dropped a hint that was not inside a task.", el);
	}

	el.remove();
}

function migrateHint(el: Element) {
	foldIntoHint(el, el.id);
}

/**
 * v1 showed explainers as tabs after submitting. v2 has no such element, so
 * their content is kept as part of the task's hint.
 */
function migrateExplainer(el: Element) {
	warn("A task explainer became part of the task's hint, since v2 has no explainers.", el);
	foldIntoHint(el);
}

/**
 * Applies a decrypted v1 solution to the already migrated answer element. Gaps,
 * marks and pairings keep their solution on the answer itself and are handled
 * by their own migrations.
 */
function applyAnswerSolution(task: Element, solution: unknown) {
	const answer = Array.from(task.children).find(child => ANSWER_TAGS.has(child.localName));
	if (!answer || solution === undefined || solution === null) return;

	if (answer.localName === "webwriter-choice" && Array.isArray(solution)) {
		// v1 listed the ids of the correct options, v2 maps every option to a boolean.
		const value: Record<string, boolean> = {};
		for (const item of answer.querySelectorAll(":scope > webwriter-choice-item")) {
			value[item.id] = solution.includes(item.id);
		}
		setSolution(answer, value);
	} else if (answer.localName === "webwriter-order" && Array.isArray(solution)) {
		const items = Array.from(answer.querySelectorAll(":scope > webwriter-order-item"));
		const ordered = solution
			.map(id => items.find(item => item.id === id))
			.filter((item): item is Element => item !== undefined);
		const rest = items.filter(item => !ordered.includes(item));

		// v2 takes the authoring order as the solution, so sort the DOM instead.
		const sorted = [...ordered, ...rest];
		for (const item of sorted) answer.appendChild(item);
		setSolution(
			answer,
			sorted.map(item => item.id),
		);
	} else if (answer.localName === "webwriter-text" && typeof solution === "string") {
		setSolution(answer, solution);
	} else if (answer.localName === "webwriter-pairing" && !answer.hasAttribute("solution")) {
		applyPairingSolution(answer, Array.isArray(solution) ? solution : []);
	}
}

// ---------------------------------------------------------------------------
// Choice and order
// ---------------------------------------------------------------------------

/** v1 kept the layout on each item, v2 keeps it on the container. */
function hoistLayout(el: Element, containerTag: string) {
	const layout = el.getAttribute("layout");
	const container = el.parentElement;
	if (layout && container?.localName === containerTag && !container.hasAttribute("layout")) {
		container.setAttribute("layout", layout);
	}
}

function migrateChoice(el: Element) {
	const mode = el.getAttribute("mode") ?? "single";

	if (mode === "truefalse") {
		// v1 deleted all options in this mode and never stored which side was
		// correct, so the author has to pick it again.
		const trueFalse = createWidget("webwriter-true-false", el.id);
		trueFalse.setAttribute("solution", "true");
		const discarded = el.querySelectorAll(":scope > webwriter-choice-item").length;
		el.replaceWith(trueFalse);
		warn(
			`A true/false question lost its solution, since v1 never stored one.${discarded ? ` ${discarded} leftover option(s) were dropped.` : ""}`,
			trueFalse,
		);
		return;
	}

	el.setAttribute("mode", mode === "multiple" ? "multiple" : "single");
	if (el.getAttribute("layout") !== "tiles") el.removeAttribute("layout");
	if (el.hasAttribute("randomorder")) el.setAttribute("randomize-order", "");
	// v1's `showsolution` is covered by the quiz-wide "detailed feedback" option.
	removeAttributes(el, "randomorder", "showsolution");

	if (!el.querySelector(":scope > webwriter-choice-item")) {
		const item = createWidget("webwriter-choice-item");
		item.appendChild(document.createElement("p"));
		el.appendChild(item);
	}

	markAsCurrent(el);
}

function migrateChoiceItem(el: Element) {
	hoistLayout(el, "webwriter-choice");
	removeAttributes(el, "layout");
	markAsCurrent(el);
}

function migrateOrder(el: Element) {
	if (el.getAttribute("layout") !== "tiles") el.removeAttribute("layout");
	removeAttributes(el, "hideorderbuttons", "showsolution");
	markAsCurrent(el);
}

function migrateOrderItem(el: Element) {
	hoistLayout(el, "webwriter-order");
	removeAttributes(el, "layout", "draggable", "droppreview", "hideorderbuttons");
	markAsCurrent(el);
}

// ---------------------------------------------------------------------------
// Text, speech and mark
// ---------------------------------------------------------------------------

function migrateText(el: Element) {
	renameAttribute(el, "freetext", "free-text");
	renameAttribute(el, "ignorecase", "ignore-case");
	renameAttribute(el, "wrongmessage", "wrong-message");
	// `showsolution` is now the quiz-wide "detailed feedback" option, `value`
	// held a learner's answer.
	removeAttributes(el, "showsolution", "value");
	markAsCurrent(el);
}

function migrateSpeech(el: Element) {
	removeAttributes(el, "loading", "recording");
	markAsCurrent(el);
}

type LegacyRange = { startContainer: string; startOffset: number; endContainer?: string; endOffset: number };

function isLegacyRange(value: unknown): value is LegacyRange {
	const range = value as LegacyRange;
	return typeof range?.startContainer === "string" && typeof range?.startOffset === "number";
}

function evaluateXPath(path: string) {
	try {
		return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	} catch {
		return null;
	}
}

/** Resolves a v1 range, which addressed its boundaries by document-wide XPath. */
function resolveLegacyRange(legacy: LegacyRange, scope: Element) {
	const start = evaluateXPath(legacy.startContainer);
	const end = legacy.endContainer ? evaluateXPath(legacy.endContainer) : start;
	if (!start || !end || !scope.contains(start) || !scope.contains(end)) return undefined;

	const range = document.createRange();
	const clamp = (node: Node, offset: number) =>
		Math.max(
			0,
			Math.min(offset, node.nodeType === Node.TEXT_NODE ? (node as Text).data.length : node.childNodes.length),
		);
	range.setStart(start, clamp(start, legacy.startOffset));
	range.setEnd(end, clamp(end, legacy.endOffset));
	return range;
}

/** The word-like segments of `root`, indexed exactly like `<webwriter-mark>` does. */
function wordSegments(root: Element) {
	const segments: Range[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		for (const segment of segmenter.segment(text.data)) {
			if (!segment.isWordLike) continue;
			const range = document.createRange();
			range.setStart(text, segment.index);
			range.setEnd(text, segment.index + segment.segment.length);
			segments.push(range);
		}
	}

	return segments;
}

function rangesOverlap(a: Range, b: Range) {
	return a.compareBoundaryPoints(Range.END_TO_START, b) < 0 && a.compareBoundaryPoints(Range.START_TO_END, b) > 0;
}

/**
 * v1 stored marked text as XPath ranges on the task, v2 stores the indices of
 * the marked words. The ranges are resolved before the content is flattened to
 * plain text, since the XPaths describe the document as it was saved.
 */
function migrateMark(el: Element) {
	const legacy = (Array.isArray(getTaskSolution(el)) ? getTaskSolution(el) : []) as unknown[];
	const ranges = legacy
		.filter(isLegacyRange)
		.map(value => resolveLegacyRange(value, el))
		.filter((range): range is Range => range !== undefined);

	if (legacy.length && !ranges.length) {
		// The XPaths were resolved against the document as it was saved, so they
		// can go stale if the surrounding content moved.
		warn("Could not locate the marked words of a task, they have to be marked again.", el);
	}

	// v2's content model is text only. Line breaks become newlines so that the
	// words around them stay separate segments.
	for (const child of Array.from(el.querySelectorAll("br, wbr"))) {
		if (child.localName === "br") child.replaceWith(document.createTextNode("\n"));
		else child.remove();
	}
	for (let child = el.firstElementChild; child; child = el.firstElementChild) {
		child.replaceWith(...Array.from(child.childNodes));
	}

	const segments = wordSegments(el);
	const solution = segments
		.map((segment, index) => (ranges.some(range => rangesOverlap(range, segment)) ? index : -1))
		.filter(index => index !== -1);

	// `highlighting` was an authoring toggle, `value` held a learner's marks.
	removeAttributes(el, "highlighting", "value");
	if (solution.length) setSolution(el, solution);
	markAsCurrent(el);
}

// ---------------------------------------------------------------------------
// Cloze (now gap)
// ---------------------------------------------------------------------------

function migrateCloze(el: Element) {
	const dragAndDrop = dragAndDropClozes.has(el);
	const gap = retag(el, "webwriter-gap");
	if (dragAndDrop) gap.setAttribute("mode", "drag-and-drop");
}

function migrateClozeGap(el: Element) {
	if (el.hasAttribute("showoptions")) {
		const cloze = el.closest("webwriter-cloze");
		if (cloze) dragAndDropClozes.add(cloze);
	}

	const solutions = parseJson(el.getAttribute("solution"));
	const accepted = Array.isArray(solutions) ? solutions.filter(value => typeof value === "string") : [];
	if (accepted.length > 1) {
		warn(`A gap accepted ${accepted.length} answers, v2 keeps only "${accepted[0]}".`, el);
	}
	if (parseJson(el.getAttribute("distraction"))) {
		warn("A gap had distractor options, which v2 does not support. They were dropped.", el);
	}

	const item = createWidget("webwriter-gap-item", el.id);
	item.textContent = accepted[0] ?? "";
	el.replaceWith(item);
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

/** Keeps only complete pairs, which are the only thing v2 can render. */
function applyPairingSolution(el: Element, legacy: unknown[]) {
	const items = Array.from(el.querySelectorAll(":scope > webwriter-pairing-item"));
	const ids = new Set(items.map(item => item.id));
	const pairs = legacy.filter(
		(entry): entry is [string, string] =>
			Array.isArray(entry) && entry.length === 2 && entry.every(id => typeof id === "string" && ids.has(id)),
	);
	const paired = new Set(pairs.flat());

	for (const item of items) {
		if (paired.has(item.id)) continue;
		warn("Removed a pairing item that was not part of a pair, which v2 cannot represent.", item);
		item.remove();
	}

	setSolution(el, pairs);
}

function migratePairing(el: Element) {
	el.setAttribute("mode", el.getAttribute("mode") === "memory" ? "memory" : "pairing");
	const legacy = parseJson(el.getAttribute("solution")) ?? getTaskSolution(el);
	applyPairingSolution(el, Array.isArray(legacy) ? legacy : []);
	markAsCurrent(el);
}

function migratePairingItem(el: Element) {
	removeAttributes(el, "draggable", "droppreview");

	// v2 allows a single `<p>` or `<picture>`, v1 allowed any flow content.
	const picture = el.querySelector("picture");
	if (picture) {
		el.replaceChildren(picture);
	} else {
		const paragraph = document.createElement("p");
		paragraph.append(...Array.from(el.childNodes));
		for (const child of Array.from(paragraph.children)) {
			if (child.localName === "p" || child.localName === "div") {
				child.replaceWith(...Array.from(child.childNodes));
			}
		}
		el.replaceChildren(paragraph);
	}

	markAsCurrent(el);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function migrateElement(el: Element) {
	switch (el.localName) {
		case "webwriter-quiz":
			return migrateQuiz(el);
		case "webwriter-task":
			return migrateTask(el);
		case "webwriter-task-prompt":
			return migratePrompt(el);
		case "webwriter-task-hint":
			return migrateHint(el);
		case "webwriter-task-explainer":
			return migrateExplainer(el);
		case "webwriter-choice":
			return migrateChoice(el);
		case "webwriter-choice-item":
			return migrateChoiceItem(el);
		case "webwriter-order":
			return migrateOrder(el);
		case "webwriter-order-item":
			return migrateOrderItem(el);
		case "webwriter-text":
			return migrateText(el);
		case "webwriter-speech":
			return migrateSpeech(el);
		case "webwriter-mark":
			return migrateMark(el);
		case "webwriter-cloze":
			return migrateCloze(el);
		case "webwriter-cloze-gap":
			return migrateClozeGap(el);
		case "webwriter-pairing":
			return migratePairing(el);
		case "webwriter-pairing-item":
			return migratePairingItem(el);
		default:
			return markAsCurrent(el);
	}
}

document.addEventListener("migrate", event => {
	const el = event.target as Element | null;
	if (!el?.classList) return;

	const classes = Array.from(el.classList);
	if (classes.find(cls => cls.startsWith("ww-pkg-"))?.slice("ww-pkg-".length) !== packageName) return;

	const major = Number.parseInt(classes.find(cls => cls.startsWith("ww-v"))?.slice("ww-v".length) ?? "", 10);
	if (!Number.isFinite(major) || major >= CURRENT_MAJOR_VERSION) return;

	try {
		migrateElement(el);
	} catch (error) {
		warn(`Could not migrate a <${el.localName}>, it may display incorrectly.`, el, error);
	}
});
