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
