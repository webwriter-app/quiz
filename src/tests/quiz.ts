import { registerQuizType } from "../api";
import "../migrate/index";
import "../widgets/choice/webwriter-choice";
import "../widgets/choice/webwriter-choice-item";
import "../widgets/choice/webwriter-true-false";
import "../widgets/gap/webwriter-gap";
import "../widgets/gap/webwriter-gap-item";
import "../widgets/order/webwriter-order";
import "../widgets/order/webwriter-order-item";
import "../widgets/pairing/webwriter-pairing";
import "../widgets/pairing/webwriter-pairing-item";
import "../widgets/speech/webwriter-speech";
import type { WebwriterSpeech } from "../widgets/speech/webwriter-speech";
import "../widgets/webwriter-mark";
import "../widgets/webwriter-quiz";
import type { WebwriterQuiz } from "../widgets/webwriter-quiz";
import "../widgets/webwriter-task";
import "../widgets/webwriter-task-prompt";
import "../widgets/webwriter-text";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function action(element: HTMLElement, label: string) {
	const methods = element as unknown as Record<string, () => void> & {
		actions: Record<string, { label: { _: string } }>;
	};
	const name = Object.keys(methods.actions).find(name => methods.actions[name].label._ === label);
	assert(name, `Missing drawer action ${label}`);
	methods[name]();
}

function report(detail: object) {
	window.dispatchEvent(new CustomEvent("test-update", { detail }));
}

async function settleUpdates() {
	// WebWriter runs package tests in an offscreen frame that may skip animation frames.
	await new Promise(resolve => setTimeout(resolve, 0));
}

async function authoring(fixture: HTMLElement) {
	fixture.contentEditable = "true";
	const quiz = document.createElement("webwriter-quiz") as WebwriterQuiz;
	fixture.append(quiz);
	await quiz.updateComplete;
	assert(!quiz.hasAttribute("hide-points") && !quiz.hidePoints, "The absent setting must use the widget default");
	quiz.setAttribute("hide-points", "");
	assert(quiz.hidePoints, "Drawer writes must update the reflected property");
	quiz.removeAttribute("hide-points");
	assert(!quiz.hidePoints, "Removing an attribute must restore its default");

	registerQuizType({
		id: "fixture-external-type", packageId: "fixture", icon: "", getName: () => "External type",
		createInstance: () => document.createElement("webwriter-true-false"),
	});
	const comment = document.createComment("preserve me");
	quiz.append(comment);
	for (const label of ["True or False", "Single Choice", "Order", "Text", "Mark", "Speech", "Gap", "Pairing", "External type"]) {
		action(quiz, label);
	}
	assert(quiz.children.length === 9, "The drawer must insert built-in and externally registered questions");
	const first = quiz.firstElementChild as HTMLElement;
	assert(first.firstElementChild?.slot === "prompt", "New questions must include a slotted prompt");
	action(first, "Move question down");
	assert(quiz.children[1] === first, "Question move must resolve the current siblings");
	action(first, "Move question up");
	action(first, "Delete question");
	assert(!first.isConnected && quiz.firstChild === comment, "Drawer edits must preserve unrelated nodes");

	const pairing = quiz.querySelector("webwriter-pairing")!;
	action(pairing, "Add Pair");
	assert(pairing.children.length === 2 && pairing.children[0].id !== pairing.children[1].id,
		"Adding a pair must create two identified authored items");
}

async function languages(fixture: HTMLElement) {
	const german = document.createElement("webwriter-quiz") as WebwriterQuiz;
	const french = document.createElement("webwriter-quiz") as WebwriterQuiz;
	fixture.lang = "de-AT";
	french.lang = "fr-CA";
	fixture.append(german, french);
	await Promise.all([german.updateComplete, french.updateComplete]);
	assert(german.options.hidePoints.label._ === "Punkte ausblenden", "Use the inherited German drawer label");
	assert(french.options.hidePoints.label._ === "Masquer les points", "Use the French widget override");
	assert(german.shadowRoot!.textContent.includes("Abgeben"), "Render German learner labels");
	assert(french.shadowRoot!.textContent.includes("Envoyer"), "Render French learner labels");
	fixture.lang = "en-GB";
	await settleUpdates();
	assert(german.shadowRoot!.textContent.includes("Submit"), "Respond to a language change on the ancestor");
	assert(french.shadowRoot!.textContent.includes("Envoyer"), "Keep the other widget's language");
}

async function titleVisibility(fixture: HTMLElement) {
	const quiz = document.createElement("webwriter-quiz") as WebwriterQuiz;
	const task = document.createElement("webwriter-task");
	const prompt = document.createElement("webwriter-task-prompt");
	prompt.slot = "prompt";
	prompt.textContent = "The authored prompt";
	task.append(prompt, document.createElement("webwriter-true-false"));
	quiz.append(task);
	fixture.append(quiz);
	await settleUpdates();
	assert(task.shadowRoot!.querySelector(".title")?.textContent === "Question 1", "Show titles by default");
	quiz.setAttribute("hide-question-title", "");
	quiz.setAttribute("hide-points", "");
	await settleUpdates();
	assert(!task.shadowRoot!.querySelector(".quiz-header"), "Hide the title and points without leaving an empty header");
	assert(task.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="prompt"]')!.assignedElements()[0] === prompt,
		"The authored prompt must still be rendered");
	quiz.removeAttribute("hide-question-title");
	await settleUpdates();
	assert(task.shadowRoot!.querySelector(".title"), "Restore the title when clearing the option");
}

async function learnerOrder(fixture: HTMLElement) {
	const order = document.createElement("webwriter-order");
	order.setAttribute("solution", '["a","b","c"]');
	for (const id of ["a", "b", "c"]) {
		const item = document.createElement("webwriter-order-item");
		item.id = id;
		item.textContent = id;
		order.append(item);
	}
	const authored = order.outerHTML;
	fixture.append(order);
	await order.updateComplete;
	const slot = order.shadowRoot!.querySelector("slot")!;
	assert(slot.assignedElements().length === 3, "Learner items must still be slotted");
	const grid = order.shadowRoot!.querySelector("draggable-grid")!;
	for (const id of ["a", "b", "c"]) {
		grid.dispatchEvent(new CustomEvent("reorder", { detail: { item: order.querySelector(`#${id}`), before: null } }));
	}
	await order.updateComplete;
	assert(slot.assignedElements().map(item => item.id).join("") === "abc", "Drop order must be visible");
	assert(order.checkAnswer(true) === 1, "Grade the order shown to the learner");
	order.reset();
	await order.updateComplete;
	assert(order.outerHTML === authored, "Playing and resetting must preserve authored item order and solution");
}

async function learnerChoice(fixture: HTMLElement) {
	const choice = document.createElement("webwriter-choice");
	choice.setAttribute("solution", '{"first":true,"second":true}');
	choice.setAttribute("randomize-order", "");
	for (const id of ["first", "second"]) {
		const item = document.createElement("webwriter-choice-item");
		item.id = id;
		item.textContent = id;
		choice.append(item);
	}
	const authored = choice.outerHTML;
	fixture.append(choice);
	await choice.updateComplete;
	choice.querySelector<HTMLElement>("#first")!.click();
	assert(choice.checkValidity() && choice.checkAnswer(true) === 1, "Grade the first correct choice in single mode");
	choice.reset();
	await choice.updateComplete;
	assert(choice.outerHTML === authored, "Shuffling and grading must leave authored choices intact");
	choice.querySelector("#first")!.remove();
	await settleUpdates();
	assert(choice.shadowRoot!.querySelector("slot")!.assignedElements().length === 1, "Use current items after a DOM change");
}

async function legacy(fixture: HTMLElement) {
	const recording = document.createElement("webwriter-speech") as WebwriterSpeech;
	recording.className = "ww-widget ww-pkg-@webwriter/quiz ww-v2.0.0 ww-visible";
	recording.setAttribute("src", "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
	fixture.append(recording);
	recording.dispatchEvent(new Event("migrate", { bubbles: true }));
	assert(recording.classList.contains("ww-v3.0.0") && recording.classList.contains("ww-visible"),
		"A v2 migration must preserve unrelated classes");
	assert(recording.checkValidity(), "A saved recording must still be available");
	recording.reset();
	assert(!recording.checkValidity() && recording.hasAttribute("src"), "Reset must leave the saved audio attribute intact");
	recording.remove();
	fixture.append(recording);
	assert(recording.checkValidity(), "Reinsertion must restore the saved audio");

	const text = document.createElement("webwriter-text");
	text.className = "ww-widget ww-pkg-@webwriter/quiz ww-v1.1.5";
	text.setAttribute("freetext", "");
	fixture.append(text);
	text.dispatchEvent(new Event("migrate", { bubbles: true }));
	assert(text.hasAttribute("free-text") && !text.hasAttribute("freetext"), "Retain the v1 migration path");
}

const cases = { authoring, languages, titleVisibility, learnerOrder, learnerChoice, legacy };
report({ type: "beforeAll" });
for (const [id, run] of Object.entries(cases)) {
	const test = { id, path: ["Quiz", id] };
	const fixture = document.createElement("div");
	document.body.append(fixture);
	report({ type: "beforeOne", ...test });
	try {
		await run(fixture);
		report({ type: "afterOne", ...test, passed: true });
	} catch (error) {
		console.error(error);
		report({ type: "afterOne", ...test, passed: false });
	} finally {
		fixture.remove();
	}
}
report({ type: "afterAll" });
