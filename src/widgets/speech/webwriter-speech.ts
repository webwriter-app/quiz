import { msg } from "@lit/localize";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw } from "@webwriter/lit";
import MicIcon from "bootstrap-icons/icons/mic.svg";
import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import LOCALIZE from "../../../localization/generated";
import { name as packageId } from "../../../package.json";

import { IWebWriterQuizType, registerQuizType } from "../../api";
import { AudioPlayer } from "./audio-player";
import { AudioRecorder } from "./audio-recorder";

declare global {
	interface HTMLElementTagNameMap {
		"webwriter-speech": WebwriterSpeech;
	}
}

registerQuizType({
	packageId,
	widgetPosition: 40,
	id: "webwriter-speech",
	getName: () => msg("Speech"),
	icon: MicIcon,
	createInstance: () => document.createElement("webwriter-speech"),
});

/**
 * An answer where learners record a spoken response.
 *
 * It must be assigned to the default slot of a `<webwriter-task>`.
 */
@customElement("webwriter-speech")
export class WebwriterSpeech extends LitElementWw implements IWebWriterQuizType {
	/** @internal */
	localize = LOCALIZE;

	/** @internal */
	static scopedElements = {
		"audio-recorder": AudioRecorder,
		"audio-player": AudioPlayer,
	};

	static styles = css`
		:host {
			display: block;
			width: 100%;
		}
	`;

	/**
	 * The recording of the learner as a data URL, or `null` if nothing was recorded yet.
	 */
	@property({ type: String, attribute: true, reflect: true })
	accessor src: string | null = null;

	reset() {
		this.src = null;
	}

	checkValidity(): boolean {
		return this.src !== null;
	}

	render() {
		if (!this.src) {
			return html`<audio-recorder
				@recording-complete=${(e: CustomEvent) => {
					const blob = e.detail.audioBlob;
					const reader = new FileReader();
					reader.onloadend = () => {
						this.src = reader.result as string;
					};
					reader.readAsDataURL(blob);
				}}
			></audio-recorder>`;
		} else {
			return html`<audio-player
				.src=${this.src}
				@delete-recording=${() => {
					this.src = null;
				}}
			></audio-player>`;
		}
	}
}
