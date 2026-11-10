import { registerQuizType } from "../api";
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
import "../widgets/webwriter-quiz-hint";
import "../widgets/webwriter-quiz";
import type { WebwriterQuiz } from "../widgets/webwriter-quiz";
import { WebwriterTask } from "../widgets/webwriter-task";
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

function addPrompt(task: HTMLElement, text = "") {
	const prompt = document.createElement("p");
	prompt.slot = "prompt";
	prompt.textContent = text;
	task.prepend(prompt);
	return prompt;
}

function clickButton(root: ShadowRoot, label: string) {
	const button = Array.from(root.querySelectorAll("sl-button")).find(button => button.textContent.trim() === label);
	assert(button instanceof HTMLElement, `Missing button ${label}`);
	button.click();
}

async function authoring(fixture: HTMLElement) {
	fixture.contentEditable = "true";
	const quiz = document.createElement("webwriter-quiz") as WebwriterQuiz;
	fixture.append(quiz);
	await quiz.updateComplete;
	assert(quiz.shadowRoot!.querySelectorAll(".insert-task-grid sl-button").length === 9,
		"An empty quiz must show all built-in insertion buttons");
	clickButton(quiz.shadowRoot!, "True or False");
	assert(quiz.firstElementChild?.matches("webwriter-true-false"), "An inline button must insert a direct task");
	await settleUpdates();
	assert(quiz.shadowRoot!.querySelector("sl-dropdown .insert-task-grid"), "Keep the question buttons in populated quizzes");
	quiz.firstElementChild?.remove();
	await settleUpdates();
	assert(!quiz.hasAttribute("hide-points") && !quiz.hidePoints, "The absent setting must use the widget default");
	quiz.setAttribute("hide-points", "");
	assert(quiz.hidePoints, "Drawer writes must update the reflected property");
	quiz.removeAttribute("hide-points");
	assert(!quiz.hidePoints, "Removing an attribute must restore its default");

	class ExternalTask extends WebwriterTask {
		checkValidity() { return true; }
		reset() {}
		protected renderAnswer() { return "External answer"; }
	}
	customElements.define("fixture-external-type", ExternalTask);
	registerQuizType({
		id: "fixture-external-type", packageId: "fixture", icon: "", getName: () => "External type",
		createInstance: () => document.createElement("fixture-external-type") as ExternalTask,
	});
	const comment = document.createComment("preserve me");
	quiz.append(comment);
	for (const label of ["True or False", "Single Choice", "Multiple Choice", "Order", "Text", "Mark", "Speech", "Gap", "Pairing", "External type"]) {
		action(quiz, label);
	}
	assert(quiz.children.length === 10, "The drawer must insert built-in and externally registered questions");
	assert(Array.from(quiz.children).every(task => task instanceof WebwriterTask), "Task types must be direct quiz children");
	const first = quiz.firstElementChild as HTMLElement;
	assert(first.localName === "webwriter-true-false", "Insert the task type without a wrapper");
	assert(first.firstElementChild?.matches('p[slot="prompt"]'), "New questions must include a slotted native paragraph");
	action(first, "Move question down");
	assert(quiz.children[1] === first, "Question move must resolve the current siblings");
	action(first, "Move question up");
	action(first, "Delete question");
	assert(!first.isConnected && quiz.firstChild === comment, "Drawer edits must preserve unrelated nodes");

	const choice = quiz.querySelector("webwriter-choice")!;
	assert(choice.options.points && choice.options.mode, "A task drawer must contain shared and type-specific options");
	assert(choice.querySelector("webwriter-choice-item"), "A new choice must include its initial option");
	const pairing = quiz.querySelector("webwriter-pairing")!;
	action(pairing, "Add Pair");
	const cards = pairing.querySelectorAll("webwriter-pairing-item");
	assert(cards.length === 2 && cards[0].id !== cards[1].id && pairing.firstElementChild?.slot === "prompt",
		"Adding a pair must create two identified authored items");
	await settleUpdates();
	assert(pairing.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="prompt"]')!.assignedElements().length === 1,
		"Pairing cards must not steal the prompt's slot");
	const hintPopup = pairing.shadowRoot!.querySelector("hint-popup")!;
	const hintButton = hintPopup.shadowRoot!.querySelector<HTMLElement>("sl-icon-button")!;
	hintButton.click();
	await settleUpdates();
	const hint = pairing.firstElementChild;
	assert(hint?.matches('webwriter-quiz-hint[slot="hint"]'), "The hint popup must insert a direct task child");
	assert(pairing.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="hint"]')!.assignedElements()[0] === hint,
		"A manual task slot must assign the direct hint");
}

async function languages(fixture: HTMLElement) {
	const german = document.createElement("webwriter-quiz") as WebwriterQuiz;
	const french = document.createElement("webwriter-quiz") as WebwriterQuiz;
	fixture.lang = "de-AT";
	french.lang = "fr-CA";
	fixture.append(german, french);
	for (let attempt = 0; attempt < 60 && (
		german.options.hidePoints.label._ !== "Punkte ausblenden" ||
		french.options.hidePoints.label._ !== "Masquer les points"
	); attempt++) await settleUpdates();
	await Promise.all([german.updateComplete, french.updateComplete]);
	assert(german.getAttribute("lang") === null, "Inherited language must stay out of authored HTML");
	assert(german.options.hidePoints.label._ === "Punkte ausblenden", "Use the inherited German drawer label");
	assert(french.options.hidePoints.label._ === "Masquer les points", "Use the French widget override");
	assert(german.shadowRoot!.textContent.includes("Abgeben"), "Render German learner labels");
	assert(french.shadowRoot!.textContent.includes("Envoyer"), "Render French learner labels");
	fixture.lang = "en-GB";
	await settleUpdates();
	await german.updateComplete;
	assert(german.getAttribute("lang") === null, "Changing the ancestor language must not add an attribute");
	assert(german.shadowRoot!.textContent.includes("Submit"), "Respond to a language change on the ancestor");
	assert(french.shadowRoot!.textContent.includes("Envoyer"), "Keep the other widget's language");
}

async function titleVisibility(fixture: HTMLElement) {
	const quiz = document.createElement("webwriter-quiz") as WebwriterQuiz;
	const task = document.createElement("webwriter-true-false");
	const prompt = addPrompt(task, "The authored prompt");
	quiz.append(task);
	fixture.append(quiz);
	await settleUpdates();
	assert(!quiz.shadowRoot!.querySelector(".insert-task-grid"), "Hide authoring buttons in use mode");
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
	const prompt = addPrompt(order, "Arrange the letters");
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
	const slot = order.shadowRoot!.querySelector<HTMLSlotElement>("slot:not([name])")!;
	assert(order.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="prompt"]')!.assignedElements()[0] === prompt,
		"Order must assign the prompt independently of the shuffled items");
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
	addPrompt(choice, "Choose an answer");
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
	assert(choice.shadowRoot!.querySelector<HTMLSlotElement>("slot:not([name])")!.assignedElements().length === 1,
		"Use current items after a DOM change");
}

async function savedRecording(fixture: HTMLElement) {
	const recording = document.createElement("webwriter-speech") as WebwriterSpeech;
	recording.setAttribute("src", "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
	fixture.append(recording);
	assert(recording.checkValidity(), "A saved recording must still be available");
	recording.reset();
	assert(!recording.checkValidity() && recording.hasAttribute("src"), "Reset must leave the saved audio attribute intact");
	recording.remove();
	fixture.append(recording);
	assert(recording.checkValidity(), "Reinsertion must restore the saved audio");
}

async function mixedQuiz(fixture: HTMLElement) {
	const quiz = document.createElement("webwriter-quiz") as WebwriterQuiz;
	const first = document.createElement("webwriter-true-false");
	const order = document.createElement("webwriter-order");
	first.setAttribute("points", "2");
	order.setAttribute("points", "3");
	const item = document.createElement("webwriter-order-item");
	item.id = "one";
	item.textContent = "Only item";
	order.append(item);
	quiz.append(first, order);
	fixture.append(quiz);
	await settleUpdates();
	assert(order.shadowRoot!.querySelector(".title")?.textContent === "Question 2", "Number tasks across different types");
	clickButton(quiz.shadowRoot!, "Submit");
	await settleUpdates();
	assert(first.shadowRoot!.querySelector(".required-warning"), "Show the unanswered warning on the task itself");
	clickButton(first.shadowRoot!, "True");
	clickButton(quiz.shadowRoot!, "Submit");
	await settleUpdates();
	assert(quiz.shadowRoot!.querySelector(".total-result strong")?.textContent === "5 / 5", "Grade the direct tasks together");
	clickButton(quiz.shadowRoot!, "Reset answers");
	await settleUpdates();
	assert(!first.checkValidity() && !quiz.shadowRoot!.querySelector(".total-result"), "Reset direct tasks and their results");
}

async function promptIsolation(fixture: HTMLElement) {
	fixture.contentEditable = "true";
	const mark = document.createElement("webwriter-mark");
	const markPrompt = addPrompt(mark, "Ignore these words");
	const answer = document.createTextNode("Highlight this");
	const markBody = document.createElement("p");
	markBody.append(answer);
	mark.append(markBody);
	const gap = document.createElement("webwriter-gap");
	const gapPrompt = addPrompt(gap, "Keep this prompt");
	const paragraph = document.createElement("p");
	paragraph.textContent = "Make a gap here";
	gap.append(paragraph);
	fixture.append(mark, gap);
	await settleUpdates();
	const selection = document.getSelection()!;
	selection.setBaseAndExtent(markPrompt.firstChild!, 0, markPrompt.firstChild!, 6);
	action(mark, "Toggle Marking at Position");
	assert(!mark.solution.length, "Prompt text must not be selectable as a mark answer");
	selection.setBaseAndExtent(answer, 0, answer, 0);
	action(mark, "Toggle Marking at Position");
	assert(mark.solution.join() === "0", "Mark indices must start in the answer body");
	selection.setBaseAndExtent(gapPrompt.firstChild!, 0, gapPrompt.firstChild!, 4);
	action(gap, "Insert gap at selection");
	assert(!gap.querySelector("webwriter-gap-item"), "Prompt text must not become a gap");
	selection.setBaseAndExtent(paragraph.firstChild!, 0, paragraph.firstChild!, 4);
	action(gap, "Insert gap at selection");
	assert(paragraph.querySelector("webwriter-gap-item")?.textContent === "Make", "Insert a gap in the answer body");
	selection.removeAllRanges();
}

const cases = { authoring, languages, titleVisibility, learnerOrder, learnerChoice, savedRecording, mixedQuiz, promptIsolation };
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
