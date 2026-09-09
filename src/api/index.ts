export type QuizType = {
	packageId: string;
	widgetPosition?: number;
	id: string;
	icon: string;
	getName(): string;
	createInstance(): HTMLElement & IWebWriterQuizType;
};

export interface IWebWriterQuizType {
	checkValidity(): boolean;
	reset(): void;
	checkAnswer?(detailedFeedback: boolean): number;
}

type WebwriterQuizRegistry = {
	version: number;
	quizTypes: QuizType[];
	listeners: ((types: readonly QuizType[]) => void)[];
};

declare global {
	interface Window {
		__wwQuizRegistry__: WebwriterQuizRegistry;
	}
}

function getRegistry(): WebwriterQuizRegistry {
	window.__wwQuizRegistry__ ??= { version: 1, quizTypes: [], listeners: [] };
	return window.__wwQuizRegistry__;
}

export function getQuizTypes(): readonly QuizType[] {
	return [...getRegistry().quizTypes];
}

export function registerQuizType(type: QuizType): void {
	const registry = getRegistry();
	
	let i = 0;

	// First, order by package id
	// The @webwriter/quiz package is always first, regardless of its package id
	if (type.packageId !== "@webwriter/quiz") {
		while (i < registry.quizTypes.length) {
			if (registry.quizTypes[i].packageId.localeCompare(type.packageId) >= 0) break;
			i++;
		}
	}

	// Then, order by widget position (ascending), and then by widget id (ascending)
	const newPosition = type.widgetPosition ?? Infinity;
	while (i < registry.quizTypes.length && registry.quizTypes[i].packageId === type.packageId) {
		const currentPosition = registry.quizTypes[i].widgetPosition ?? Infinity;
		if (currentPosition > newPosition) break;
		// Use id as a tiebreaker (alphabetical order)
		if (currentPosition === newPosition && registry.quizTypes[i].id.localeCompare(type.id) >= 0) break;
		i++;
	}

	registry.quizTypes.splice(i, 0, type);

	const quizTypes = getQuizTypes();
	registry.listeners.forEach(cb => cb(quizTypes));
}

export function onQuizTypesChanged(cb: (types: readonly QuizType[]) => void): () => void {
	const registry = getRegistry();
	cb(getQuizTypes());
	registry.listeners.push(cb);
	return () => registry.listeners = registry.listeners.filter(l => l !== cb);
}
