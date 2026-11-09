import type { ReactiveController } from "lit";
import type { WebwriterTask } from "../widgets/webwriter-task";
import { randomizeArray } from "./utils";

/** Assign items to a manual slot in learner order without moving their authored nodes. */
export class QuizItems<T extends HTMLElement> implements ReactiveController {
	private learnerOrder: T[] | undefined;

	constructor(
		private host: WebwriterTask,
		private tag: string,
		private shuffleInUse: () => boolean,
	) {
		host.addController(this);
	}

	get authored(): T[] {
		return Array.from(this.host.children).filter(
			(child): child is T => child.localName === this.tag && !child.slot,
		);
	}

	get ordered(): T[] {
		const items = this.authored;
		if (this.host.editable || !this.shuffleInUse()) {
			this.learnerOrder = undefined;
			return items;
		}
		if (!this.learnerOrder) this.learnerOrder = randomizeArray(items);
		const retained = this.learnerOrder.filter(item => items.includes(item));
		return (this.learnerOrder = [...retained, ...items.filter(item => !retained.includes(item))]);
	}

	shuffle() {
		this.learnerOrder = undefined;
		this.host.requestUpdate();
	}

	move(item: HTMLElement, before: HTMLElement | null) {
		const items = [...this.ordered];
		const from = items.indexOf(item as T);
		if (from === -1 || item === before) return;
		items.splice(from, 1);
		const to = before ? items.indexOf(before as T) : items.length;
		if (to === -1) return;
		items.splice(to, 0, item as T);
		this.learnerOrder = items;
		this.host.requestUpdate();
	}

	hostDisconnected() {
		this.learnerOrder = undefined;
	}

	hostUpdated() {
		const slot = this.host.renderRoot.querySelector<HTMLSlotElement>("slot:not([name])");
		if (!slot) return;
		const ordered = this.ordered;
		const items = new Set(ordered);
		let index = 0;
		const children = Array.from(this.host.childNodes).flatMap<Element | Text>(node => {
			if (node instanceof Text) return [node];
			if (!(node instanceof Element) || node.slot) return [];
			return [items.has(node as T) ? ordered[index++] : node];
		});
		const assigned = slot.assignedNodes();
		if (children.length !== assigned.length || children.some((node, index) => node !== assigned[index])) {
			slot.assign(...children);
		}
	}
}
