import { css } from "lit";

export const questionPickerStyles = css`
	.insert-task-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
		gap: var(--sl-spacing-small);

		sl-button::part(base) {
			justify-content: flex-start;
		}
	}

	.add-question {
		max-inline-size: 100%;
		margin-inline-start: auto;
	}

	.insert-task-grid sl-button::part(label),
	.add-question sl-button::part(label) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.dropdown-container {
		width: min(100cqi, 36rem);
		box-sizing: border-box;
		padding: var(--sl-spacing-x-small);
	}
`;
