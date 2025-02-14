import { LitElement, html, css, CSSResultArray, CSSResult, PropertyValueMap, PropertyValues } from "lit"
import { customElement, property, query, queryAssignedElements } from "lit/decorators.js"
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js"
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js"
import IconChevronDown from "bootstrap-icons/icons/chevron-down.svg"

import { ifDefined } from "lit/directives/if-defined.js"
import { styleMap } from "lit/directives/style-map.js"

@customElement("ww-combobox")
export class Combobox extends LitElement {

  static shadowRootOptions = {...LitElement.shadowRootOptions, delegatesFocus: true}

  constructor() {
    super()
    this.addEventListener("focus", e => {this.active = true; this.open = true})
    this.addEventListener("focusout", e => {
      this.active = this.open = false
    })
    this.addEventListener("blur", e => {
      this.active = this.open = false
    })
    this.value = this.defaultValue = this.multiple? []: ""
  }

  tabIndex = 0

  @property({attribute: false}) //@ts-ignore
  accessor value: string[] | string

  @property({attribute: false}) //@ts-ignore
  accessor defaultValue: string[] | string

  @query("input") //@ts-ignore
  accessor input: HTMLInputElement

  @query("#toggle")
  accessor toggleButton: HTMLInputElement

  @query("slot:not([name])")
  accessor slotElement: HTMLSlotElement

  @queryAssignedElements()
  accessor optionElements: HTMLElement[]

  @property({type: String, attribute: true}) //@ts-ignore
  accessor autocomplete: SlInput["autocomplete"] = "off"

  @property({type: Boolean, attribute: true, reflect: true})
  accessor active: boolean

  @property({type: Boolean, attribute: true, reflect: true})
  accessor inputDisabled: boolean = false

  @property({type: Boolean, attribute: true, reflect: true})
  accessor multiple: boolean = false

  @property({type: String}) //@ts-ignore
  accessor placeholder: string
  
  @property({type: String, attribute: true, reflect: true})
  accessor emptyValue: string

  @property({type: Boolean, attribute: true, reflect: true})
  accessor open: boolean = false

  @property({type: Boolean, attribute: true, reflect: true})
  accessor suggestions: boolean = false

  @property({type: String, attribute: "help-text"}) //@ts-ignore
  accessor helpText: string

  @property({type: Number, attribute: true})
  accessor fixLength: number
  
  @property({type: String, attribute: true})
  accessor separator: string = " "

  @property({type: String, attribute: true})
  accessor placement = "bottom" as const

  @property({type: Boolean, attribute: true, reflect: true})
  accessor autosize = false

  @property({type: Boolean, attribute: true, reflect: true})
  accessor disabled = false

  @property({type: Boolean, attribute: true, reflect: true})
  accessor required = false

  @property({type: String, attribute: true, reflect: true})
  accessor type: "button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week"

  @property({type: String, attribute: true, reflect: true})
  accessor label: string

  get validity() {
    return this.input.validity
  }

  get validationMessage() {
    return this.input.validationMessage
  }

  setValidity(isValid: boolean) {
    const host = this
    const required = Boolean(this.required)
    host.toggleAttribute('data-required', required)
    host.toggleAttribute('data-optional', !required)
    host.toggleAttribute('data-invalid', !isValid)
    host.toggleAttribute('data-valid', isValid)
  }

  focus() {
    if(this.inputDisabled && this.suggestions) {
      this.open = !this.open
      super.focus()
    }
    else {
      this.input?.focus()
    }
  }

  blur() {
    this.open = false
  }

  getForm() {
    return this.input.form
  }

  static styles: CSSResult | CSSResultArray = [SlInput.styles, css`
    * {
      font-family: var(--sl-font-sans);
    }

    :host {
      display: flex;
      flex-direction: column;
    }

    [part=base] {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      position: relative;
      border: solid var(--sl-input-border-width) var(--sl-input-border-color);
      border-radius: var(--sl-input-border-radius-medium);
      max-width: 100%;
      min-height: var(--sl-input-height-medium);
      padding: 0 var(--sl-input-spacing-medium);
      padding-right: 0;
      background: white;
    }

    :host(:not([inputDisabled]):not([disabled])) {
      cursor: text;
    }

    :host([inputDisabled]:not([disabled])), :host([inputDisabled]:not([disabled])) input {
      cursor: pointer;
    }

    :host([multiple]) [part=base] {
      flex-wrap: wrap;
    }

    :host([filled]) [part=base] {
      background: var(--sl-input-filled-background-color);
    }

    :host([active]) [part=base] {
      border-color: var(--sl-input-border-color-focus);
      box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
    }

    :host([disabled]) [part=base] {
      background: none;
    }

    :host(:hover) [part=base] {
      border-color: var(--sl-color-gray-400);
    }

    #values {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.25rem;
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;
      flex-wrap: wrap;
    }

    #values > * {
      margin-top: 0.125rem;
      margin-bottom: 0.125rem;
    }

    #options {
      display: block;
      font-family: var(--sl-font-sans);
      font-size: var(--sl-font-size-medium);
      font-weight: var(--sl-font-weight-normal);
      box-shadow: var(--sl-shadow-large);
      background: var(--sl-panel-background-color);
      border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
      border-radius: var(--sl-border-radius-medium);
      padding-block: var(--sl-spacing-x-small);
      padding-inline: 0;
      overflow: auto;
      overscroll-behavior: none;
      width: 100%;
      max-height: var(--auto-size-available-height);
    }

    :host(:is(:not([open]), :not([suggestions]))) #options {
      display: none;
    }

    #options::part(base) {
      width: 100%;
      border-top: none;
    }

    input {
      flex-grow: 1;
      display: inline-flex;
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--sl-input-font-size-small);
    }

    :host(:not([suggestions])) sl-menu, :host(:not([suggestions])) #toggle {
      display: none;
    }

    #toggle {
      padding-right: var(--sl-input-spacing-medium);
    }

    :host([size=small]) #toggle {
      padding-right: var(--sl-spacing-2x-small);
      font-size: var(--sl-input-font-size-small);
    }

    #toggle::part(base) {
      padding: 0;
    }

    #toggle::part(base) {
      transition: transform 0.25s ease;
    }

    :host([open]) #toggle::part(base) {
      transform: rotate(180deg);
    }

    :host([open]) {
      z-index: 100;
    }

    sl-dropdown::part(panel) {
      width: 100%;
    }

    [part=suffix] {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      max-width: 50%;
      flex-grow: 0;
    }

    [part=label]::slotted(*), label {
      align-self: flex-start;
      margin-bottom: var(--sl-spacing-3x-small);
    }

    :host([required]) [part=label]::after {
      content: "*";
      margin-left: 0.25ch;
    }

    :host(:not([help-text])) #help-text {
      display: none;
    }

    #help-text {
      font-size: var(--sl-input-help-text-font-size-medium);
      color: var(--sl-input-help-text-color);
      margin-top: var(--sl-spacing-3x-small);
    }

    slot[name=prefix]::slotted(:last-child) {
      margin-right: 1ch;
    }

    :host([size=small]) [part=base] {
      min-height: var(--sl-input-height-small);
      padding: 0 var(--sl-input-spacing-small);
    }

    #hide {
      height: 0;
      position: absolute;
      right: 0;
      bottom: 0;
      white-space: pre;
      overflow: hidden;
      font-size: var(--sl-input-font-size-small);
    }
  `]

  handleTextInput(e: Event) {
    const input = e.target as HTMLInputElement
    e.preventDefault()
    if(!this.multiple && this.fixLength && input.value.length < this.fixLength) {
      input.value = this.value as string
    }
    else if(!this.multiple) {
      this.value = input.value
    }
    else if(input.value === this.separator) {
      input.value = ""
    }
    else {
      this.value = [...this.valueList.slice(0, -1), ...input.value.split(this.separator)]
      input.value = this.valueList.at(-1)!
    }
    this.dispatchInput()
    this.setValidity(this.validity.valid)
  }

  handleInputKeydown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement
    if(this.multiple && e.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault()
      this.value = this.valueList.slice(0, -1)
    }
    this.requestUpdate()
  }

  handleOptionClick = (e: PointerEvent) => {
    const option = (e.target as HTMLElement).closest("sl-option") as SlOption | null
    if(option) {
      this.value = option.value
      this.focus()
      this.open = false
      this.dispatchChange()
      this.requestUpdate()
    }
  }

  dispatchChange() {
    this.dispatchEvent(new CustomEvent("sl-change", {composed: true, bubbles: true}))
  }

  dispatchInput() {
    this.dispatchEvent(new CustomEvent("sl-input", {composed: true, bubbles: true}))
  }

  get valueList() {
    return (this.multiple? this.value || []: [this.value])  as string[]
  }

  get inputSize() {
    return !this.multiple? undefined: Math.min(
      Math.max(this.placeholder?.length ?? 1, this.valueList.at(-1)!?.length ?? 1 - 1),
      40
    )
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties)
    this.requestUpdate()
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.requestUpdate()
  }

  @query("#hide")
  accessor hideEl: HTMLElement

  @query("input")
  accessor inputEl: HTMLInputElement

  get inputWidth() {
    return this.hideEl? this.hideEl.offsetWidth: 0
  }

  get inputValue() {
    const value = this.multiple? this.valueList.at(-1) ?? "": String(this.value ?? "")
    return value !== this.emptyValue? value: ""
  }

  render() {
    const input = html`
      <input
        part="input"
        type=${this.type}
        size=${ifDefined(this.inputSize)}
        .value=${this.inputValue}
        placeholder=${this.multiple && this.valueList.length > 1? "": this.placeholder}
        ?disabled=${this.disabled || this.inputDisabled}
        @input=${this.handleTextInput}
        @change=${this.dispatchChange}
        @keydown=${this.handleInputKeydown}
        autocomplete=${this.autocomplete as any}
        style=${this.autosize? styleMap({width: `calc(${this.inputWidth}px + 2ch)`}): undefined}
      >
    `
    return html`
      <slot name="label" part="label" @click=${this.focus}>
        <label>${this.label}</label> 
      </slot>
      <div part="base" id="anchor" tabindex=${0}>
        <slot name="prefix"></slot>
        ${this.multiple? html`
          <span id="values">
            <slot name="values"></slot>
            ${this.valueList.slice(0, -1).map(v => html`
              <sl-tag size="small" variant="primary">${v}</sl-tag>
            `)}
            ${input}
          </span>
        `: input}
        <div part="suffix">
          <slot name="suffix"></slot>
            <sl-icon-button
              slot="trigger"
              part="trigger"
              id="toggle"
              src=${IconChevronDown}
              @focus=${(e: Event) => e.stopPropagation()}
              @click=${(e: Event) => {this.open = !this.open; e.stopPropagation()}}
              @mousedown=${(e: Event) => {e.stopPropagation(); e.preventDefault()}}
            ></sl-icon-button>
        </div>
      </div>
      <sl-popup anchor="anchor" placement=${this.placement} strategy="fixed" ?active=${this.open} auto-size="vertical" auto-size-padding="10" flip shift>
          <sl-menu id="options" @click=${this.handleOptionClick}>
            <slot></slot>
          </sl-menu>
        </sl-popup>
      <div id="help-text">${this.helpText}</div>
      <span id="hide">${this.inputEl?.value}</span>
    `
  }
}