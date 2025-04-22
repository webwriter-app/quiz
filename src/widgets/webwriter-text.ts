import {html, css, PropertyValues, TemplateResult} from "lit"
import {LitElementWw, option} from "@webwriter/lit"
import {customElement, property, query} from "lit/decorators.js"
import {ifDefined} from "lit/directives/if-defined.js"

import SlTextarea from "@shoelace-style/shoelace/dist/components/textarea/textarea.component.js"
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js"
import "@shoelace-style/shoelace/dist/themes/light.css"

import LOCALIZE from "../../localization/generated"
import {msg} from "@lit/localize"

declare global {interface HTMLElementTagNameMap {
  "webwriter-text": WebwriterText;
}}

@customElement("webwriter-text")
export class WebwriterText extends LitElementWw {

  localize = LOCALIZE

  @property({type: String, attribute: true, reflect: true})
  @option({
    type: "select",
    label: {"en": "Type", "de": "Typ"},
    options: [
      {value: "long-text", label: {"en": "Long Text", "de": "Langer Text"}},
      {value: "text", label: {"en": "Short Text", "de": "Kurzer Text"}},
      {value: "number", label: {"en": "Number", "de": "Zahl"}},
      {value: "date", label: {"en": "Date", "de": "Datum"}},
      {value: "time", label: {"en": "Time", "de": "Uhrzeit"}},
      {value: "datetime-local", label: {"en": "Date & Time", "de": "Datum & Uhrzeit"}}
    ]
  })
  accessor type: "date" | "datetime-local" | "number" | "text" | "time" | "long-text" = "long-text"

  @property({type: String, attribute: true, reflect: true})
  @option()
  accessor placeholder: string

  @property({type: Boolean, attribute: true, reflect: true})
  @option({
    type: Boolean,
    label: {"en": "free answer (ignores the other options)", "de": "Freitext (ignoriert andere Optionen)"},
  })
  accessor freeText = false

  @property({type: Boolean, attribute: true, reflect: true})
  @option({
    type: Boolean,
    label: {"en": "Ignore capitalization", "de": "Großschreibung ignorieren"},
  })
  accessor ignoreCase = false

  @property({type: Boolean, attribute: true, reflect: true})
  @option({
    type: Boolean,
    label: {"en": "show Solution", "de": "Lösung anzeigen"},
  })
  accessor showSolution = false

  @property({type: String, attribute: true, reflect: true})
  @option({
    label: {"en": "Message for wrong solution", "de": "Nachricht bei falscher Lösung"},
  })
  accessor wrongMessage: string

  @property({type: String, attribute: true, reflect: true})
  accessor value: string

  /*
  @property({type: Number, attribute: true, reflect: true})
  @option({type: Number})
  min: number

  @property({type: Number, attribute: true, reflect: true})
  @option({type: Number})
  max: number

  @property({type: Number, attribute: true, reflect: true})
  @option({type: Number})
  step: number
  */

  static scopedElements = {
    "sl-textarea": SlTextarea,
    "sl-input": SlInput
  }

  static styles = css`
    :host(:is([contenteditable=true], [contenteditable=""])) sl-textarea::part(textarea) {
      color: var(--sl-color-success-700);
    }

    sl-textarea {
      resize: vertical;
      overflow: hidden;
      min-height: 40px;

      &::part(form-control), &::part(form-control-input), &::part(base), &::part(textarea) {
        height: 100%;
      }
    }

    :is(sl-textarea, sl-input)[data-correct]::part(base) {
      background: var(--sl-color-success-200);
    }

    #solution {
      padding: 1rem;
    }

    #solution[data-correct] {
      background-color: var(--sl-color-success-200);
    }

    #solution:not([data-correct]) {
      background-color: var(--sl-color-danger-200);
    }
  `

  handleChange = (e: CustomEvent) => {
    const target = e.target as SlTextarea | SlInput
    if(this.isContentEditable) {
      this.solution = target.value?.trim()
    }
    else {
      this.value = target.value?.trim()
    }
    this.dispatchEvent(new CustomEvent("ww-answer-change", {
      detail: {value: target.value},
      bubbles: true,
      composed: true
    }))
  }

  @query("sl-textarea, sl-input")
  accessor input: SlTextarea | SlInput

  focus() {
    this.input.focus()
  }

  reset() {
    this.solution = undefined
    if(!this.freeText){
      this.input.value = ""
    }
    
    
    let inputElem: SlTextarea | SlInput = this.shadowRoot.getElementById("inputElem") as SlTextarea | SlInput
    inputElem.disabled = false
  }

  reportSolution() {
    let inputElem: SlTextarea | SlInput = this.shadowRoot.getElementById("inputElem") as SlTextarea | SlInput
    inputElem.disabled = true
  }

  @property({type: String, attribute: false, reflect: false})
  accessor solution: string

  render() {
    const correct = this.freeText ? this.value?.trim() != "" : !this.ignoreCase ? this.solution && this.value?.trim() === 
    this.solution : this.solution && this.value?.trim().toLowerCase() === this.solution.toLowerCase()
    if(this.freeText && correct){
      this.solution = this.value
    }
    const textarea = html`<sl-textarea id="inputElem" ?data-correct=${correct && !(this.freeText)} value=${this.isContentEditable? this.solution: this.value} placeholder=${this.placeholder} resize="none" @sl-change=${this.handleChange}></sl-textarea>`
    const input = html`<sl-input id="inputElem" ?data-correct=${correct} value=${this.isContentEditable? this.solution: this.value} 
    placeholder=${this.placeholder} type=${this.type} @sl-change=${this.handleChange}></sl-input>`
    return html`
      ${this.type === "long-text"? textarea: input}
      ${this.solution && !this.isContentEditable && !correct? html`<div id="solution" ?data-correct=${correct}>${this.showSolution?this.solution:html`<i>${this.wrongMessage}</i>`}</div>`: undefined}
    `
  }
}