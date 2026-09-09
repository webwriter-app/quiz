import { msg, str } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { css, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";

import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlDropdown from "@shoelace-style/shoelace/dist/components/dropdown/dropdown.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlMenu from "@shoelace-style/shoelace/dist/components/menu/menu.component.js";
import SlRange from "@shoelace-style/shoelace/dist/components/range/range.component.js";

import PauseFillIcon from "bootstrap-icons/icons/pause-fill.svg";
import PlayFillIcon from "bootstrap-icons/icons/play-fill.svg";
import SlidersIcon from "bootstrap-icons/icons/sliders.svg";
import TrashIcon from "bootstrap-icons/icons/trash.svg";
import {
	BAR_WIDTH,
	formatDuration,
	peakAmplitude,
	SAMPLE_BAR_SPACING,
	WaveformCanvas,
	waveformStyles,
} from "./waveform";

const PLAYHEAD_RADIUS = 5;

export class AudioPlayer extends LitElementWw {
	static scopedElements = {
		"sl-button": SlButton,
		"sl-icon": SlIcon,
		"sl-button-group": SlButtonGroup,
		"sl-dropdown": SlDropdown,
		"sl-menu": SlMenu,
		"sl-range": SlRange,
	};

	static styles = [
		waveformStyles,
		css`
			:host {
				display: flex;
				gap: var(--sl-spacing-small);
				align-items: center;
			}

			.duration {
				white-space: nowrap;
			}

			.waveform {
				min-width: 0;
				cursor: pointer;
			}

			.options {
				padding: var(--sl-spacing-small);
				min-width: 170px;
				background-color: var(--sl-color-neutral-0);
			}
		`,
	];

	@property({ type: String, attribute: true, reflect: true })
	accessor src: string | null = null;

	@state() private accessor playing = false;
	@state() private accessor currentTime = 0;
	@state() private accessor duration = 0;
	@state() private accessor volume = 100;
	@state() private accessor playbackSpeed = 1;

	private audioElement: HTMLAudioElement | null = null;
	private audioContext: AudioContext | null = null;
	private amplitudeSamples: number[] = [];
	private animationFrameId: number | null = null;

	private waveform = new WaveformCanvas();
	private resizeObserver = new ResizeObserver(() => this.resizeCanvas());

	disconnectedCallback() {
		super.disconnectedCallback();
		this.stopAnimationLoop();
		this.resizeObserver.disconnect();
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement = null;
		}
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
	}

	updated(changedProperties: Map<string, unknown>) {
		if (changedProperties.has("src") && this.src) {
			this.loadAudio();
		}
	}

	firstUpdated() {
		this.resizeCanvas();
		this.observeWaveform();
	}

	protected update(changedProperties: PropertyValues): void {
		super.update(changedProperties);
		this.observeWaveform();
	}

	/** Re-observing the same element is a no-op, so this can run on every update. */
	private observeWaveform() {
		const container = this.waveform.container.value;
		if (container) this.resizeObserver.observe(container);
	}

	private resizeCanvas() {
		if (this.waveform.resize()) this.renderWaveform();
	}

	private async loadAudio() {
		if (!this.src) return;

		// Create audio element for playback
		this.audioElement = new Audio(this.src);
		this.audioElement.volume = this.volume / 100;
		this.audioElement.playbackRate = this.playbackSpeed;
		this.audioElement.addEventListener("loadedmetadata", () => {
			this.duration = this.audioElement!.duration;
		});
		// The animation loop only samples while playing, so the canvas would keep showing the
		// position of its last frame when playback stops. Re-sync whenever the clock settles.
		for (const event of ["play", "pause", "seeked"]) {
			this.audioElement.addEventListener(event, () => this.syncCurrentTime());
		}
		this.audioElement.addEventListener("ended", () => {
			this.playing = false;
			this.stopAnimationLoop();
			this.currentTime = 0;
			this.audioElement!.currentTime = 0;
			this.renderWaveform();
		});

		// Decode audio to generate waveform
		await this.generateWaveformData();
		this.renderWaveform();
	}

	private async generateWaveformData() {
		if (!this.src) return;

		try {
			// Fetch and decode the audio data
			const response = await fetch(this.src);
			const arrayBuffer = await response.arrayBuffer();

			this.audioContext = new AudioContext();
			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
			const channelData = audioBuffer.getChannelData(0);

			// Downsample the channel data to one peak per bar that fits into the canvas
			const containerWidth = this.waveform.containerBounds?.width;
			const targetSamples = containerWidth ? Math.ceil(containerWidth / SAMPLE_BAR_SPACING) : 200;
			const samplesPerBar = Math.floor(channelData.length / targetSamples);

			this.amplitudeSamples = [];
			for (let i = 0; i < targetSamples; i++) {
				const start = i * samplesPerBar;
				const end = Math.min(start + samplesPerBar, channelData.length);
				this.amplitudeSamples.push(peakAmplitude(channelData, start, end));
			}

			// Close audio context after decoding (we use HTMLAudioElement for playback)
			this.audioContext.close();
			this.audioContext = null;
		} catch (e) {
			console.error("Failed to generate waveform data:", e);
		}
	}

	/** Horizontal extent the waveform occupies, inset so the playhead fits at either end. */
	private extent(totalWidth: number) {
		return { start: PLAYHEAD_RADIUS, span: Math.max(0, totalWidth - PLAYHEAD_RADIUS * 2) };
	}

	private renderWaveform() {
		const ctx = this.waveform.begin();
		if (!ctx || this.amplitudeSamples.length === 0) return;

		const { height, activeColor, inactiveColor } = this.waveform;
		const { start, span } = this.extent(this.waveform.width);
		const barSpacing = span / this.amplitudeSamples.length;
		const playbackProgress = this.duration > 0 ? this.currentTime / this.duration : 0;
		const playbackX = start + playbackProgress * span;

		this.amplitudeSamples.forEach((amplitude, i) => {
			const x = start + i * barSpacing + barSpacing / 2;
			this.waveform.drawBar(x, amplitude, inactiveColor);

			// Redraw the played part of the bar on top, clipped to the playback position
			if (x - BAR_WIDTH / 2 >= playbackX) return;
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, playbackX, height);
			ctx.clip();
			this.waveform.drawBar(x, amplitude, activeColor);
			ctx.restore();
		});

		ctx.beginPath();
		ctx.arc(playbackX, height / 2, PLAYHEAD_RADIUS, 0, 2 * Math.PI);
		ctx.fillStyle = activeColor;
		ctx.fill();
	}

	/** Draws the position the media element is actually at, rather than the last sampled one. */
	private syncCurrentTime() {
		if (!this.audioElement) return;
		this.currentTime = this.audioElement.currentTime;
		this.renderWaveform();
	}

	private startAnimationLoop() {
		const animate = () => {
			if (!this.playing || !this.audioElement) return;
			this.currentTime = this.audioElement.currentTime;
			this.renderWaveform();
			this.animationFrameId = requestAnimationFrame(animate);
		};
		this.animationFrameId = requestAnimationFrame(animate);
	}

	private stopAnimationLoop() {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	private togglePlayPause() {
		if (!this.audioElement) return;

		if (this.playing) {
			this.audioElement.pause();
			this.playing = false;
			this.stopAnimationLoop();
			this.syncCurrentTime();
		} else {
			// Resume where the playhead was actually drawn: pausing makes the media element drop
			// the audio it had buffered but not played yet, so its clock would otherwise pick back
			// up an output buffer's worth further ahead and the playhead would jump.
			this.audioElement.currentTime = this.currentTime;
			this.audioElement.play();
			this.playing = true;
			this.startAnimationLoop();
		}
	}

	private handleWaveformClick(e: MouseEvent) {
		const bounds = this.waveform.containerBounds;
		if (!this.audioElement || this.duration === 0 || !bounds) return;

		const { start, span } = this.extent(bounds.width);
		const clickX = Math.min(Math.max(e.clientX - bounds.left, start), bounds.width - PLAYHEAD_RADIUS);
		const progress = (clickX - start) / Math.max(1, span);

		this.audioElement.currentTime = progress * this.duration;
		this.currentTime = this.audioElement.currentTime;
		this.renderWaveform();
	}

	private handleVolumeChange(e: Event) {
		this.volume = Number((e.target as HTMLInputElement).value);
		if (this.audioElement) this.audioElement.volume = this.volume / 100;
	}

	private handleSpeedChange(e: Event) {
		this.playbackSpeed = Number((e.target as HTMLInputElement).value);
		if (this.audioElement) this.audioElement.playbackRate = this.playbackSpeed;
	}

	render() {
		return html`
			<sl-button variant="primary" circle @click=${this.togglePlayPause}>
				<sl-icon src=${this.playing ? PauseFillIcon : PlayFillIcon}></sl-icon>
			</sl-button>
			<span class="duration">${formatDuration(this.currentTime)} / ${formatDuration(this.duration)}</span>
			<div class="waveform" ${ref(this.waveform.container)} @click=${this.handleWaveformClick}>
				<canvas ${ref(this.waveform.canvas)}></canvas>
			</div>
			<sl-button-group>
				<sl-dropdown placement="bottom-end">
					<sl-button slot="trigger" caret>
						<sl-icon src=${SlidersIcon}></sl-icon>
					</sl-button>
					<div class="options">
						<sl-range
							label=${msg(str`Volume: ${this.volume}%`)}
							min="0"
							max="100"
							value=${this.volume}
							tooltip="none"
							@sl-input=${this.handleVolumeChange}
						></sl-range>
						<sl-range
							label=${msg(str`Speed: ${this.playbackSpeed}x`)}
							min="0.5"
							max="2"
							step="0.1"
							tooltip="none"
							value=${this.playbackSpeed}
							@sl-input=${this.handleSpeedChange}
						></sl-range>
					</div>
				</sl-dropdown>
				<sl-button
					@click=${() => this.dispatchEvent(new CustomEvent("delete-recording", { bubbles: true, composed: true }))}
				>
					<sl-icon src=${TrashIcon}></sl-icon>
				</sl-button>
			</sl-button-group>
		`;
	}
}
