/**
 * @returns True if the user is using WebWriter, false otherwise.
 */
export const isWebWriter = () => document.documentElement.id.startsWith("ww-");

/**
 * Equivalent to the check used in ProseMirror to determine if the user is on a Mac or iOS device,
 * which is used to determined if the `Mod-` key refers to `Meta` or `Control`.
 * @see https://code.haverbeke.berlin/prosemirror/prosemirror-keymap/src/commit/176de4152dca0e473f74504e8995d7a281392eb5/src/keymap.ts#L5
 *
 * @returns True if the user is on a Mac or iOS device, false otherwise.
 */
export const isMac = () => typeof navigator != "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

let enterCreatesNewSelectors = new Set<string>();
let enterCreatesNewInitialized = false;

export function registerAsEnterCreatesNew(selector: string) {
	if (!isWebWriter()) return;

	enterCreatesNewSelectors.add(selector.toLowerCase());
	if (!enterCreatesNewInitialized) {
		document.body.addEventListener(
			"keydown",
			event => {
				if (!event.isTrusted) return;

				const focus = document.getSelection()?.focusNode;
				const closestElement = focus?.parentElement?.closest(Array.from(enterCreatesNewSelectors).join(","));
				const insideHint = !!focus?.parentElement?.closest("webwriter-quiz-hint");

				if (closestElement && !insideHint && event.key === "Enter") {
					event.preventDefault();
					event.stopImmediatePropagation();

					const modKey = !event.shiftKey;
					const ctrlEnterEvent = new KeyboardEvent("keydown", {
						key: "Enter",
						metaKey: modKey && isMac(),
						ctrlKey: modKey && !isMac(),
					});
					document.body.dispatchEvent(ctrlEnterEvent);
				}
			},
			true,
		);
		enterCreatesNewInitialized = true;
	}
}

export interface RelativeSelectionEndpoint {
	path: number[];
	offset: number;
}

export interface RelativeSelection {
	anchor: RelativeSelectionEndpoint;
	focus: RelativeSelectionEndpoint;
}

/**
 * Serializes the current selection relative to `root`
 * @returns the serialized selection, or `undefined` if there is no selection or if the selection is not fully contained in `root`
 */
export function serializeRelativeSelection(root: Node): RelativeSelection | undefined {
	const selection = root.ownerDocument?.getSelection();
	if (!selection?.anchorNode || !selection.focusNode) return;

	const serialize = (node: Node, offset: number): RelativeSelectionEndpoint | undefined => {
		const path = [];
		while (node !== root) {
			const parent = node.parentNode;
			if (!parent) return;
			path.unshift(Array.prototype.indexOf.call(parent.childNodes, node));
			node = parent;
		}
		return { path, offset };
	};

	const anchor = serialize(selection.anchorNode, selection.anchorOffset);
	const focus = serialize(selection.focusNode, selection.focusOffset);
	if (anchor && focus) return { anchor, focus };
}

/**
 * Restores a selection previously serialized with `serializeRelativeSelection` on the given `root` element.
 * @returns true if the selection was successfully restored
 */
export function restoreRelativeSelection(root: Node, relative: RelativeSelection): boolean {
	const resolve = ({ path, offset }: RelativeSelectionEndpoint) => {
		let node = root;
		for (const index of path) {
			node = node.childNodes[index];
			if (!node) return;
		}
		const maxOffset =
			node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE
				? (node.textContent?.length ?? 0)
				: node.childNodes.length;
		return offset >= 0 && offset <= maxOffset ? { node, offset } : undefined;
	};

	const anchor = resolve(relative.anchor);
	const focus = resolve(relative.focus);
	const selection = root.ownerDocument?.getSelection();
	if (!anchor || !focus || !selection) return false;

	selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
	return true;
}

/**
 * Runs a DOM mutation and restores the selection in the replacement element with the same ID.
 * This overrides ProseMirror's behavior of trying to select the old "same" position from the old document
 */
export function mutateWithStableSelection(root: HTMLElement, mutator: () => void) {
	const savedSelection = serializeRelativeSelection(root);
	mutator();
	const newRoot = document.getElementById(root.id);
	if (newRoot && savedSelection) restoreRelativeSelection(newRoot, savedSelection);
}
