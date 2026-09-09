import { css } from "lit";

export const commonStyles = css`
	:host(:not([contenteditable="true"]):not([contenteditable=""])) .author-only {
		display: none;
	}

	:host(:is([contenteditable="true"], [contenteditable=""])) .user-only {
		display: none;
	}
`;

export function randomizeArray<T>(items: T[]): T[] {
	const randomized = [...items];
	for (let i = randomized.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[randomized[i], randomized[j]] = [randomized[j], randomized[i]];
	}
	return randomized;
}

const resolvedCssVariableCache = new Map<string, string>();

export function resolveCssVariable(variableName: `--${string}`, fallback: string) {
	const cachedValue = resolvedCssVariableCache.get(variableName);
	if (cachedValue) return cachedValue;

	const value = getComputedStyle(document.body).getPropertyValue(variableName).trim() || fallback;

	resolvedCssVariableCache.set(variableName, value);
	return value;
}

export class BiMap<K, V> {
	private readonly keyToValue = new Map<K, V>();
	private readonly valueToKey = new Map<V, K>();

	set(key: K, value: V): this {
		if (this.keyToValue.has(key)) {
			const oldValue = this.keyToValue.get(key)!;
			this.valueToKey.delete(oldValue);
		}

		if (this.valueToKey.has(value)) {
			const oldKey = this.valueToKey.get(value)!;
			this.keyToValue.delete(oldKey);
		}

		this.keyToValue.set(key, value);
		this.valueToKey.set(value, key);

		return this;
	}

	getValue(key: K): V | undefined {
		return this.keyToValue.get(key);
	}

	getKey(value: V): K | undefined {
		return this.valueToKey.get(value);
	}

	hasKey(key: K): boolean {
		return this.keyToValue.has(key);
	}

	hasValue(value: V): boolean {
		return this.valueToKey.has(value);
	}

	deleteKey(key: K): boolean {
		if (!this.keyToValue.has(key)) return false;

		const value = this.keyToValue.get(key)!;
		this.keyToValue.delete(key);
		this.valueToKey.delete(value);
		return true;
	}

	deleteValue(value: V): boolean {
		if (!this.valueToKey.has(value)) return false;

		const key = this.valueToKey.get(value)!;
		this.valueToKey.delete(value);
		this.keyToValue.delete(key);
		return true;
	}

	clear(): void {
		this.keyToValue.clear();
		this.valueToKey.clear();
	}

	get size(): number {
		return this.keyToValue.size;
	}
}
