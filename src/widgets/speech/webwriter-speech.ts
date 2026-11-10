import "@shoelace-style/shoelace/dist/themes/light.css";
import MicIcon from "bootstrap-icons/icons/mic.svg";
import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { name as packageId } from "../../../package.json";

import { registerQuizType } from "../../api";
import { AudioPlayer } from "./audio-player";
import { AudioRecorder } from "./audio-recorder";
import { messageFor } from "../../lib/localization";
import { WebwriterTask } from "../webwriter-task";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-speech": WebwriterSpeech;
	}
}

registerQuizType({
	packageId,
	widgetPosition: 40,
	id: "webwriter-speech",
	getName: (locale, translate = messageFor(locale)) => translate("Speech"),
	icon: MicIcon,
	createInstance: () => document.createElement("webwriter-speech"),
});

/**
 * An answer where learners record a spoken response.
 */
@customElement("webwriter-speech")
export class WebwriterSpeech extends WebwriterTask {
	/** @internal */
	static scopedElements = {
		...WebwriterTask.scopedElements,
		"audio-recorder": AudioRecorder,
		"audio-player": AudioPlayer,
	};

	static styles = [WebwriterTask.styles, css`
		:host {
			display: block;
			width: 100%;
		}
	`];

	/**
	 * An existing recording URL saved in authored HTML.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor src: string | null = null;

	@state() private accessor recording: string | null | undefined;

	private get activeSource() {
		return this.editable || this.recording === undefined ? this.src : this.recording;
	}

	private discardRecording() {
		if (this.recording) URL.revokeObjectURL(this.recording);
		this.recording = undefined;
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.discardRecording();
	}

	reset() {
		this.renderRoot?.querySelector<AudioRecorder>("audio-recorder")?.cancelRecording();
		this.discardRecording();
		this.recording = null;
	}

	checkValidity(): boolean {
		return Boolean(this.activeSource);
	}

	protected renderAnswer() {
		const source = this.activeSource;
		if (!source) {
			return html`<audio-recorder
				.disabled=${this.editable}
				@recording-complete=${(e: CustomEvent) => {
					if (!this.isConnected || this.editable) return;
					const blob = e.detail.audioBlob;
					this.discardRecording();
					this.recording = URL.createObjectURL(blob);
				}}
			></audio-recorder>`;
		} else {
			return html`<audio-player
				.src=${source}
				.allowDelete=${!this.editable}
				@delete-recording=${() => {
					if (!this.editable) this.reset();
				}}
			></audio-player>`;
		}
	}
}
