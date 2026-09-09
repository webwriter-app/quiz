import { css } from "lit";
import { createRef } from "lit/directives/ref.js";

import { resolveCssVariable } from "../../lib/utils";

/** Horizontal distance between two amplitude bars, in CSS pixels. */
export const SAMPLE_BAR_SPACING = 6;
/** Stroke width of a single amplitude bar, in CSS pixels. */
export const BAR_WIDTH = 3;

/** Styles shared by the recorder and player waveforms. */
export const waveformStyles = css`
	.duration {
		font-feature-settings: "tnum";
		font-variant-numeric: tabular-nums;
	}

	.waveform {
		flex-grow: 1;
		height: 40px;
		overflow: hidden;
	}

	.waveform canvas {
		display: block;
	}
`;

/** Formats a duration in seconds as MM:SS. */
export function formatDuration(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.floor(seconds % 60);
	return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

/**
 * Largest deviation of `data[start..end)` from `center`, normalized to 0-1 by `scale`.
 * Time domain data is unsigned (0-255 around 128), decoded sample data is signed (-1 to 1).
 */
export function peakAmplitude(data: ArrayLike<number>, start: number, end: number, center = 0, scale = 1) {
	let peak = 0;
	for (let i = start; i < end; i++) {
		const amplitude = Math.abs(data[i] - center) / scale;
		if (amplitude > peak) peak = amplitude;
	}
	return peak;
}

export class WaveformCanvas {
	readonly container = createRef<HTMLDivElement>();
	readonly canvas = createRef<HTMLCanvasElement>();

	private ctx: CanvasRenderingContext2D | null = null;

	get width() {
		return (this.ctx?.canvas.width ?? 0) / devicePixelRatio;
	}

	get height() {
		return (this.ctx?.canvas.height ?? 0) / devicePixelRatio;
	}

	get containerBounds() {
		return this.container.value?.getBoundingClientRect();
	}

	get activeColor() {
		return resolveCssVariable("--sl-color-primary-600", "#0484c7");
	}

	get inactiveColor() {
		return resolveCssVariable("--sl-color-neutral-200", "#e4e4e7");
	}

	get backgroundColor() {
		return resolveCssVariable("--sl-color-neutral-0", "#ffffff");
	}

	/** Matches the canvas backing store to its container, accounting for the device pixel ratio. */
	resize() {
		const bounds = this.containerBounds;
		const canvas = this.canvas.value;
		if (!bounds || !canvas) return false;

		canvas.width = bounds.width * devicePixelRatio;
		canvas.height = bounds.height * devicePixelRatio;
		canvas.style.width = `${bounds.width}px`;
		canvas.style.height = `${bounds.height}px`;

		this.ctx = canvas.getContext("2d")!;
		this.ctx.resetTransform();
		this.ctx.scale(devicePixelRatio, devicePixelRatio);
		return true;
	}

	/** Clears the canvas and returns its context, or null while the canvas is not sized yet. */
	begin() {
		this.ctx?.clearRect(0, 0, this.width, this.height);
		return this.ctx;
	}

	/** Draws a single bar of the given amplitude (0-1), vertically centered at `x`. */
	drawBar(x: number, amplitude: number, color: string) {
		const ctx = this.ctx!;
		ctx.beginPath();
		ctx.moveTo(x, (this.height / 2) * (0.95 - amplitude * 0.85));
		ctx.lineTo(x, (this.height / 2) * (1.05 + amplitude * 0.85));
		ctx.strokeStyle = color;
		ctx.lineCap = "round";
		ctx.lineWidth = BAR_WIDTH;
		ctx.stroke();
	}
}
