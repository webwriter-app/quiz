import { msg } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { css, html } from "lit";
import { state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";

import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";

import ExclamationCircle from "bootstrap-icons/icons/exclamation-circle.svg";
import MicFillIcon from "bootstrap-icons/icons/mic-fill.svg";
import PauseFillIcon from "bootstrap-icons/icons/pause-fill.svg";
import PlayFillIcon from "bootstrap-icons/icons/play-fill.svg";
import StopFillIcon from "bootstrap-icons/icons/stop-fill.svg";
import { formatDuration, peakAmplitude, SAMPLE_BAR_SPACING, WaveformCanvas, waveformStyles } from "./waveform";

const SAMPLES_PER_SECOND = 15;
const FADE_WIDTH = 20;

export class AudioRecorder extends LitElementWw {
	static scopedElements = {
		"sl-button": SlButton,
		"sl-icon": SlIcon,
	};

	static styles = [
		waveformStyles,
		css`
			:host {
				display: flex;
				gap: var(--sl-spacing-x-small);
				align-items: center;
			}

			.error {
				color: var(--sl-color-danger-600);
				gap: 0.3em;
			}

			.info,
			.error {
				flex-grow: 1;
				display: flex;
				align-items: center;
			}
		`,
	];

	@state() private accessor recording = false;
	@state() private accessor paused = false;
	@state() private accessor errorMessage: string | null = null;
	@state() private accessor duration = "00:00";

	private mediaStream!: MediaStream;
	private mediaRecorder!: MediaRecorder;
	private audioChunks: Blob[] = [];

	// Audio analysis for waveform visualization
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private analyserDataArray: Uint8Array | null = null;
	private amplitudeSamples: number[] = [];
	private lastSampleTime: number = 0;
	private sampleProgress: number = 0;
	private sampleIntervalId: number | null = null;

	private recordingStartTime: number = 0;
	private recordingTimeOffset: number = 0;
	private pausedAt: number = 0;

	private waveform = new WaveformCanvas();

	private sampleAmplitude = () => {
		if (!this.analyser || !this.analyserDataArray) return;

		// Get time domain data (waveform), where 0-255 is the sample value and 128 is silence
		// @ts-ignore
		this.analyser.getByteTimeDomainData(this.analyserDataArray);

		// Store the peak amplitude of this window (clamped to 0-1) and its timestamp
		const peak = peakAmplitude(this.analyserDataArray, 0, this.analyserDataArray.length, 128, 128);
		this.amplitudeSamples.push(Math.min(1, peak * 2));
		this.lastSampleTime = Date.now();
	};

	private startSampling() {
		// Continue where the last interval left off, so the waveform does not jump on resume
		this.lastSampleTime = Date.now() - this.sampleProgress;
		this.sampleIntervalId = window.setInterval(this.sampleAmplitude, 1000 / SAMPLES_PER_SECOND);
	}

	private stopSampling() {
		if (this.sampleIntervalId === null) return;

		this.sampleProgress = Date.now() - this.lastSampleTime;
		clearInterval(this.sampleIntervalId);
		this.sampleIntervalId = null;
	}

	private async startRecording() {
		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
		} catch (e) {
			if (e instanceof Error && e.name === "NotAllowedError") {
				this.errorMessage = msg("WebWriter does not have permission to access the microphone.");
			} else {
				this.errorMessage = msg("An error occurred while accessing the microphone.");
			}
			return;
		}
		this.mediaRecorder = new MediaRecorder(this.mediaStream);

		this.audioChunks = [];
		this.mediaRecorder.ondataavailable = event => {
			if (event.data.size > 0) this.audioChunks.push(event.data);
		};
		this.mediaRecorder.onstop = () => {
			const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
			this.dispatchEvent(
				new CustomEvent("recording-complete", {
					detail: { audioBlob },
					bubbles: true,
					composed: true,
				}),
			);
		};

		this.mediaRecorder.start();

		// Set up audio analysis for waveform visualization
		this.audioContext = new AudioContext();
		const source = this.audioContext.createMediaStreamSource(this.mediaStream);
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 256;
		source.connect(this.analyser);
		this.analyserDataArray = new Uint8Array(this.analyser.frequencyBinCount);
		this.amplitudeSamples = [];
		this.sampleProgress = 0;
		this.startSampling();

		this.recordingStartTime = Date.now();
		this.recordingTimeOffset = 0;

		this.recording = true;
		await this.updateComplete;
		this.waveform.resize();
		requestAnimationFrame(this.renderWaveform);
	}

	private stopRecording() {
		// this.recording = false
		this.paused = false;
		this.mediaRecorder.stop();
		this.mediaStream.getTracks().forEach(track => track.stop());

		// Clean up audio analysis resources
		this.stopSampling();
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
		this.analyser = null;
		this.analyserDataArray = null;
	}

	private pauseRecording() {
		if (!this.recording || this.paused) return;

		this.paused = true;
		this.pausedAt = Date.now();

		this.mediaRecorder.pause();
		this.stopSampling();

		// Suspend audio context to save resources
		if (this.audioContext) this.audioContext.suspend();
	}

	private resumeRecording() {
		if (!this.recording || !this.paused) return;

		// Add the paused duration to the offset so time calculations remain correct
		this.recordingTimeOffset += this.pausedAt - this.recordingStartTime;
		this.recordingStartTime = Date.now();

		this.mediaRecorder.resume();
		if (this.audioContext) this.audioContext.resume();
		this.startSampling();

		this.paused = false;
		requestAnimationFrame(this.renderWaveform);
	}

	private renderWaveform = () => {
		if (!this.recording || this.paused) return;

		const recordingTimeMs = Date.now() - this.recordingStartTime + this.recordingTimeOffset;
		this.duration = formatDuration(recordingTimeMs / 1000);

		const ctx = this.waveform.begin();
		if (!ctx) return;

		const { width, height, activeColor, inactiveColor, backgroundColor } = this.waveform;

		// Shift all bars by the fraction of a sample interval that has passed since the last sample,
		// so the waveform scrolls smoothly instead of jumping from sample to sample
		const msSinceLastSample = Date.now() - this.lastSampleTime;
		const fractionalPart = Math.min(1, msSinceLastSample / (1000 / SAMPLES_PER_SECOND));
		const offset = fractionalPart * SAMPLE_BAR_SPACING;

		// Draw bars by index relative to the center, not by pixel position:
		// i = 0 is the center (most recent sample), negative = past, positive = future
		const centerX = width / 2;
		const barsOnLeft = Math.ceil(centerX / SAMPLE_BAR_SPACING) + 1;
		const barsOnRight = Math.ceil((width - centerX) / SAMPLE_BAR_SPACING) + 1;

		for (let i = -barsOnLeft; i <= barsOnRight; i++) {
			const x = centerX + i * SAMPLE_BAR_SPACING - offset;
			const sampleIndex = this.amplitudeSamples.length - 1 + i;

			// Future bars and past bars without samples are flat and gray, the rest use their sample
			const hasSample = i <= 0 && sampleIndex >= 0;
			this.waveform.drawBar(
				x,
				hasSample ? this.amplitudeSamples[sampleIndex] : 0,
				hasSample ? activeColor : inactiveColor,
			);
		}

		// Center line
		ctx.beginPath();
		ctx.moveTo(centerX, 0);
		ctx.lineTo(centerX, height);
		ctx.strokeStyle = inactiveColor;
		ctx.lineWidth = 1;
		ctx.stroke();

		// Fade the waveform out towards both edges
		for (const [from, to, fadeX] of [
			[backgroundColor, "rgba(255, 255, 255, 0)", 0],
			["rgba(255, 255, 255, 0)", backgroundColor, width - FADE_WIDTH],
		] as const) {
			const gradient = ctx.createLinearGradient(fadeX, 0, fadeX + FADE_WIDTH, 0);
			gradient.addColorStop(0, from);
			gradient.addColorStop(1, to);
			ctx.fillStyle = gradient;
			ctx.fillRect(fadeX, 0, FADE_WIDTH, height);
		}

		requestAnimationFrame(this.renderWaveform);
	};

	render() {
		let content = null;

		if (!this.recording) {
			if (this.errorMessage) {
				content = html`<span class="error"><sl-icon src=${ExclamationCircle}></sl-icon>${this.errorMessage}</span>`;
			} else {
				content = html`<span class="info">${msg("Click to Start Recording")}</span>`;
			}
		} else {
			content = html`
				<sl-button circle @click=${() => (this.paused ? this.resumeRecording() : this.pauseRecording())}>
					<sl-icon src=${this.paused ? PlayFillIcon : PauseFillIcon}></sl-icon>
				</sl-button>
				<span class="duration">${this.duration}</span>
				<div class="waveform" ${ref(this.waveform.container)}>
					<canvas ${ref(this.waveform.canvas)}></canvas>
				</div>
			`;
		}

		return html`<sl-button
				variant="primary"
				circle
				@click=${() => (this.recording ? this.stopRecording() : this.startRecording())}
			>
				<sl-icon src=${this.recording ? StopFillIcon : MicFillIcon}></sl-icon>
			</sl-button>
			${content}`;
	}
}
