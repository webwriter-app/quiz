import { msg } from "@lit/localize";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import { action, LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import HighlighterIcon from "bootstrap-icons/icons/highlighter.svg";
import { css, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { name as packageId } from "../../package.json";
import { IWebWriterQuizType, registerQuizType } from "../api";
import { encryptedProperty, encryptPlaintextAttributes } from "../lib/encrypted-property";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-mark": WebWriterMark;
	}
}

export type MarkGradingMethod = "pass-fail" | "partial";

registerQuizType({
	packageId,
	widgetPosition: 20,
	id: "webwriter-mark",
	getName: () => msg("Mark"),
	icon: HighlighterIcon,
	createInstance: () => document.createElement("webwriter-mark"),
});

type WordSegment = { node: Text; start: number; end: number };
type HighlightGroup = "marked" | "correct" | "missed" | "wrong";

function rangesOverlap(a: Range, b: Range): boolean {
	return a.compareBoundaryPoints(Range.END_TO_START, b) < 0 && a.compareBoundaryPoints(Range.START_TO_END, b) > 0;
}

/**
 * An answer where learners mark the words of a text that fit the question.
 *
 * The text must be assigned to the default slot; the element itself must be
 * assigned to the default slot of a `<webwriter-task>`.
 */
@customElement("webwriter-mark")
export class WebWriterMark extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	get dynamicOptions(): Record<string, OptionDeclaration> {
		return {
			"grading-method": {
				type: "select",
				options: [
					{ value: "pass-fail", label: { _: msg("Pass/Fail") } },
					{ value: "partial", label: { _: msg("Partial Credit") } },
				],
				label: { _: msg("Grading Method") },
			},
		};
	}

	/** @internal */
	static scopedElements = {
		"sl-tooltip": SlTooltip,
	};

	private static segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

	// Since highlights are document-level, we should share them across all instances of this widget.
	private static highlights: Record<HighlightGroup, Highlight> = {
		marked: new Highlight(),
		correct: new Highlight(),
		missed: new Highlight(),
		wrong: new Highlight(),
	};

	static {
		for (const [group, highlight] of Object.entries(this.highlights)) {
			CSS.highlights.set(`webwriter-mark-${group}`, highlight);
		}
	}

	static styles = css`
		:host {
			display: block;
			min-height: 1rem;
			position: relative;
		}

		slot {
			display: block;
			cursor: text;
		}

		:host(:not([contenteditable="true"]):not([contenteditable=""])) slot {
			cursor: pointer;
			user-select: none;
		}

		slot[data-empty]::after {
			content: var(--ww-placeholder);
			position: absolute;
			left: 0;
			top: 0;
			color: darkgray;
			pointer-events: none;
			user-select: none;
		}

		:host ::highlight(webwriter-mark-marked) {
			background-color: var(--sl-color-primary-200);
		}

		:host ::highlight(webwriter-mark-correct) {
			background-color: var(--sl-color-success-200);
		}

		:host ::highlight(webwriter-mark-missed) {
			background-color: var(--sl-color-warning-200);
			text-decoration: underline dashed;
		}

		:host ::highlight(webwriter-mark-wrong) {
			background-color: var(--sl-color-danger-200);
			text-decoration: line-through;
		}

		.enter-anchor {
			position: absolute;
		}
	`;

	/**
	 * How the score of this answer is calculated.
	 *
	 * - `pass-fail`: Full score only if exactly the correct words are marked.
	 * - `partial`: Correctly marked words earn credit, wrong ones subtract from it.
	 */
	@property({ type: String, attribute: "grading-method", reflect: true })
	accessor gradingMethod: MarkGradingMethod = "pass-fail";

	/**
	 * The indices of the word-like segments counting as correct. It is obfuscated in the markup so that learners cannot read it directly.
	 */
	@property({ type: Array, attribute: "solution", reflect: true, converter: encryptedProperty })
	accessor solution: number[] = [];

	@state() private accessor currentAnswer: number[] = [];
	@state() private accessor graded: boolean = false;
	@state() private accessor detailedFeedback: boolean = false;

	private renderedRanges: Record<HighlightGroup, Range[]> = {
		marked: [],
		correct: [],
		missed: [],
		wrong: [],
	};

	private observer = new MutationObserver(records => this.handleMutation(records));

	private enterTooltipRef = createRef<SlTooltip>();
	private enterAnchorRef = createRef<HTMLDivElement>();

	protected firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		encryptPlaintextAttributes(this);
	}

	connectedCallback(): void {
		super.connectedCallback();
		this.observer.observe(this, { childList: true, characterData: true, subtree: true });
		document.addEventListener("keydown", this.handleKeyDown, { capture: true });
		document.addEventListener("selectionchange", this.handleSelectionChange);
		this.requestUpdate();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.observer.disconnect();
		document.removeEventListener("keydown", this.handleKeyDown, { capture: true });
		document.removeEventListener("selectionchange", this.handleSelectionChange);
		for (const group of Object.keys(this.renderedRanges) as HighlightGroup[]) this.setHighlight(group, []);
	}

	private getWordSegments(): WordSegment[] {
		const segments: WordSegment[] = [];
		const walker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			for (const segment of WebWriterMark.segmenter.segment((node as Text).data)) {
				if (segment.isWordLike) {
					segments.push({
						node: node as Text,
						start: segment.index,
						end: segment.index + segment.segment.length,
					});
				}
			}
		}
		return segments;
	}

	private toRange({ node, start, end }: WordSegment): Range {
		const range = new Range();
		range.setStart(node, start);
		range.setEnd(node, end);
		return range;
	}

	private setHighlight(group: HighlightGroup, ranges: Range[]) {
		const highlight = WebWriterMark.highlights[group];
		for (const range of this.renderedRanges[group]) highlight.delete(range);
		for (const range of ranges) highlight.add(range);
		this.renderedRanges[group] = ranges;
	}

	private renderHighlights() {
		const segments = this.getWordSegments();
		const toRanges = (indices: number[]) => indices.filter(i => segments[i]).map(i => this.toRange(segments[i]));

		const showFeedback = this.graded && this.detailedFeedback && !this.isContentEditable;
		const marked = this.isContentEditable ? this.solution : this.currentAnswer;
		const solution = new Set(this.solution);
		const answer = new Set(this.currentAnswer);

		this.setHighlight("marked", showFeedback ? [] : toRanges(marked));
		this.setHighlight("correct", showFeedback ? toRanges(this.currentAnswer.filter(i => solution.has(i))) : []);
		this.setHighlight("missed", showFeedback ? toRanges(this.solution.filter(i => !answer.has(i))) : []);
		this.setHighlight("wrong", showFeedback ? toRanges(this.currentAnswer.filter(i => !solution.has(i))) : []);
	}

	protected updated(): void {
		this.renderHighlights();
	}

	private handleMutation(records: MutationRecord[]) {
		if (this.isContentEditable) {
			const liveRanges = this.renderedRanges.marked.filter(range => !range.collapsed);
			const solution = this.getWordSegments()
				.map((segment, index) => (liveRanges.some(range => rangesOverlap(range, this.toRange(segment))) ? index : -1))
				.filter(index => index !== -1);
			const changed =
				solution.length !== this.solution.length || solution.some((index, i) => index !== this.solution[i]);
			if (changed) this.solution = solution;
		}
		// Redraw the normalized highlight ranges and refresh the placeholder state
		this.requestUpdate();
	}

	private toggleIndices(current: number[], indices: number[]): number[] {
		const result = new Set(current);
		for (const index of indices) {
			if (result.has(index)) result.delete(index);
			else result.add(index);
		}
		return [...result].sort((a, b) => a - b);
	}

	private toggleSolutionMarking(point: CaretPosition | null): boolean {
		const segments = this.getWordSegments();
		const selection = document.getSelection();
		const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : null;

		let indices: number[];
		if (selectionRange && !selectionRange.collapsed && this.contains(selectionRange.commonAncestorContainer)) {
			indices = segments
				.map((segment, index) => (rangesOverlap(selectionRange, this.toRange(segment)) ? index : -1))
				.filter(index => index !== -1);
		} else {
			const node = point ? point.offsetNode : selection?.anchorNode;
			const offset = point ? point.offset : (selection?.anchorOffset ?? 0);
			const index = segments.findIndex(
				segment => segment.node === node && segment.start <= offset && offset <= segment.end,
			);
			indices = index === -1 ? [] : [index];
		}

		if (indices.length === 0) return false;
		this.solution = this.toggleIndices(this.solution, indices);
		return true;
	}

	/** @internal */
	@action({ label: { _: msg("Toggle Marking at Position") } })
	toggleMarkingAtPosition() {
		if (!this.isContentEditable) return;
		this.toggleSolutionMarking(null);
	}

	private handleContextMenu(event: MouseEvent) {
		if (!this.isContentEditable) return;
		const point = document.caretPositionFromPoint(event.clientX, event.clientY);
		if (this.toggleSolutionMarking(point)) event.preventDefault();
	}

	private handleClick(event: MouseEvent) {
		if (this.isContentEditable || this.graded) return;
		const point = document.caretPositionFromPoint(event.clientX, event.clientY);
		if (!point) return;
		const segments = this.getWordSegments();
		const index = segments.findIndex(
			segment => segment.node === point.offsetNode && segment.start <= point.offset && point.offset <= segment.end,
		);
		if (index === -1) return;
		this.currentAnswer = this.toggleIndices(this.currentAnswer, [index]);
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		if (!this.isContentEditable) return;
		const selection = document.getSelection();

		// As ProseMirror re-creates the DOM on a line break, we cannot support multi-line highlights.
		// Therefore, we show a tooltip when the user presses Enter in the widget to inform them about this limitation.
		if (event.key === "Enter" && selection?.focusNode?.parentElement === this) {
			event.preventDefault();
			const range = document.createRange();
			range.setStart(selection.focusNode, selection.focusOffset); // = cursor position
			range.collapse(true);
			const cursorRect = range.getBoundingClientRect();
			const thisRect = this.shadowRoot!.host.getBoundingClientRect();
			this.enterAnchorRef.value!.style.left = `${cursorRect.left - thisRect.left}px`;
			this.enterAnchorRef.value!.style.top = `${cursorRect.bottom - thisRect.top}px`;
			this.enterTooltipRef.value!.show();
		} else {
			this.enterTooltipRef.value!.hide();
		}
	};

	private handleSelectionChange = () => {
		this.enterTooltipRef.value!.hide();
	};

	checkValidity(): boolean {
		return this.currentAnswer.length > 0;
	}

	checkAnswer(detailedFeedback: boolean): number {
		this.graded = true;
		this.detailedFeedback = detailedFeedback;

		const solution = new Set(this.solution);
		const selected = new Set(this.currentAnswer);
		const selectedCorrect = selected.intersection(solution);
		const selectedWrong = selected.difference(solution);

		if (solution.size === 0) return 0;
		if (this.gradingMethod === "pass-fail") {
			return selectedWrong.size === 0 && selectedCorrect.size === solution.size ? 1 : 0;
		} else {
			return Math.max(0, selectedCorrect.size - selectedWrong.size) / solution.size;
		}
	}

	reset(): void {
		this.currentAnswer = [];
		this.graded = false;
		this.detailedFeedback = false;
	}

	render() {
		return html` <slot
				style=${styleMap({
					"--ww-placeholder": `"${msg("Text to Highlight")}"`,
				})}
				?data-empty=${!this.textContent}
				@click=${this.handleClick}
				@contextmenu=${this.handleContextMenu}
			></slot>
			<sl-tooltip
				${ref(this.enterTooltipRef)}
				content=${msg("Multiple lines are not supported")}
				trigger="manual"
				placement="bottom"
			>
				<div ${ref(this.enterAnchorRef)} class="enter-anchor"></div>
			</sl-tooltip>`;
	}
}
