# Quiz (`@webwriter/quiz@2.0.0`)
[License: MIT](LICENSE) | Version: 2.0.0

Add interactive tasks (multiple choice, order, free text, highlighting, or speech input). Make a quiz out of multiple tasks.





## `WebwriterQuiz` (`<webwriter-quiz>`)
A quiz groups multiple `<webwriter-task>` elements into one exercise that is
submitted, graded and reset as a whole.

The tasks must be assigned to the default slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-quiz.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-quiz.js"></script>
<webwriter-quiz></webwriter-quiz>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-quiz.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-quiz.js"></script>
<webwriter-quiz></webwriter-quiz>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `detailedFeedback` (`detailed-feedback`) | `boolean` | Whether learners see per-answer feedback and the solution after submitting. | `false` | ✓ |
| `confirmSubmit` (`confirm-submit`) | `boolean` | Whether learners have to confirm a dialog before submitting. | `false` | ✓ |
| `confirmReset` (`confirm-reset`) | `boolean` | Whether learners have to confirm a dialog before resetting. | `false` | ✓ |
| `hidePoints` (`hide-points`) | `boolean` | Whether the points of each task and the total score are hidden. | `false` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterTask` (`<webwriter-task>`)
A task describes a single quiz question, which consists of a
`<webwriter-task-prompt>`, an optional `<webwriter-quiz-hint>` and an answer
of a certain type, such as `<webwriter-choice>`.

The `<webwriter-task-prompt>` must be assigned to the `prompt` slot, the
`<webwriter-quiz-hint>` must be assigned to the `hint` slot and the answer
must be assigned to the default slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-task.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-task.js"></script>
<webwriter-task></webwriter-task>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-task.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-task.js"></script>
<webwriter-task></webwriter-task>
```

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public fields, methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterTaskPrompt` (`<webwriter-task-prompt>`)
The question text of a `<webwriter-task>`.

It must be assigned to the `prompt` slot of its parent element. An optional
`<webwriter-quiz-hint>` may be assigned to its `hint` slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-task-prompt.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-task-prompt.js"></script>
<webwriter-task-prompt></webwriter-task-prompt>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-task-prompt.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-task-prompt.js"></script>
<webwriter-task-prompt></webwriter-task-prompt>
```

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public fields, methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterQuizHint` (`<webwriter-quiz-hint>`)
A generic hint element that can be used inside a variety of elements that
explicitly mention it in their documentation, such as `<webwriter-task>`.

Unless otherwise specified, it should be assigned to the `hint` slot of its
parent element.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-quiz-hint.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-quiz-hint.js"></script>
<webwriter-quiz-hint></webwriter-quiz-hint>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-quiz-hint.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-quiz-hint.js"></script>
<webwriter-quiz-hint></webwriter-quiz-hint>
```

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public fields, methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterTrueFalse` (`<webwriter-true-false>`)
An answer where learners decide whether a statement is true or false.

It must be assigned to the default slot of a `<webwriter-task>`.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-true-false.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-true-false.js"></script>
<webwriter-true-false></webwriter-true-false>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-true-false.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-true-false.js"></script>
<webwriter-true-false></webwriter-true-false>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `solution` (`solution`) | `TrueFalse` | The value counting as correct.<br><br>- `true`: The statement is true.<br>- `false`: The statement is false. | `"true"` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `reset` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterChoice` (`<webwriter-choice>`)
An answer where learners pick one or more options.

The options must be `<webwriter-choice-item>` elements assigned to the
default slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-choice.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-choice.js"></script>
<webwriter-choice></webwriter-choice>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-choice.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-choice.js"></script>
<webwriter-choice></webwriter-choice>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `mode` (`mode`) | `ChoiceMode` | How many options learners may select.<br><br>- `single`: Exactly one option can be selected.<br>- `multiple`: Any number of options can be selected. | `"single"` | ✓ |
| `layout` (`layout`) | `ChoiceLayout` | How the options are arranged.<br><br>- `list`: One option per row.<br>- `tiles`: A responsive grid of equally sized tiles. | `"list"` | ✓ |
| `gradingMethod` (`grading-method`) | `ChoiceGradingMethod` | How the score of this answer is calculated.<br><br>- `pass-fail`: Full score only if exactly the correct options are selected.<br>- `partial`: Correct selections earn credit, wrong ones subtract from it. | `"pass-fail"` | ✓ |
| `solution` (`solution`) | `ChoiceSolution` | The options counting as correct, as a map from option ID to whether it has to be selected.<br>It is obfuscated in the markup so that learners cannot read it directly. | `{}` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`
| `reset` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterChoiceItem` (`<webwriter-choice-item>`)
A single option of a `<webwriter-choice>`.

It must be assigned to the default slot of its parent element. An optional
`<webwriter-quiz-hint>` may be assigned to its `hint` slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-choice-item.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-choice-item.js"></script>
<webwriter-choice-item></webwriter-choice-item>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-choice-item.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-choice-item.js"></script>
<webwriter-choice-item></webwriter-choice-item>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `feedbackSelected` (`feedback-selected`) | `string` | The feedback shown after submitting if learners selected this option. | `""` | ✓ |
| `feedbackNotSelected` (`feedback-not-selected`) | `string` | The feedback shown after submitting if learners did not select this option. | `""` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterOrder` (`<webwriter-order>`)
An answer where learners drag items into the correct order.

The items must be `<webwriter-order-item>` elements assigned to the default
slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-order.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-order.js"></script>
<webwriter-order></webwriter-order>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-order.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-order.js"></script>
<webwriter-order></webwriter-order>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `layout` (`layout`) | `OrderLayout` | How the items are arranged.<br><br>- `list`: One item per row.<br>- `tiles`: A responsive grid of equally sized tiles. | `"list"` | ✓ |
| `direction` (`direction`) | `OrderDirection` | The direction in which the items are numbered.<br><br>- `ascending`: The first item carries the lowest position.<br>- `descending`: The first item carries the highest position. | `"ascending"` | ✓ |
| `numberingStyle` (`numbering-style`) | `OrderNumberingStyle` | How the position of each item is labelled.<br><br>- `none`: No position is shown.<br>- `numeric`: Arabic numerals (1., 2., 3., ...).<br>- `alphabetic`: Latin letters (A., B., C., ...).<br>- `roman`: Roman numerals (I., II., III., ...). | `"numeric"` | ✓ |
| `gradingMethod` (`grading-method`) | `OrderGradingMethod` | How the score of this answer is calculated.<br><br>- `pass-fail`: Full score only if every item is in its correct position.<br>- `partial-position`: Credit for each item in its correct position.<br>- `partial-sequence`: Credit for each pair of adjacent items in the correct order. | `"pass-fail"` | ✓ |
| `solution` (`solution`) | `OrderSolution` | The IDs of the items in their correct order. It is obfuscated in the markup so that learners cannot read it directly. | `[]` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `reset` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterOrderItem` (`<webwriter-order-item>`)
A single item of a `<webwriter-order>`.

It must be assigned to the default slot of its parent element. An optional
`<webwriter-quiz-hint>` may be assigned to its `hint` slot.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-order-item.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-order-item.js"></script>
<webwriter-order-item></webwriter-order-item>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-order-item.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-order-item.js"></script>
<webwriter-order-item></webwriter-order-item>
```

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public fields, methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterSpeech` (`<webwriter-speech>`)
An answer where learners record a spoken response.

It must be assigned to the default slot of a `<webwriter-task>`.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-speech.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-speech.js"></script>
<webwriter-speech></webwriter-speech>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-speech.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-speech.js"></script>
<webwriter-speech></webwriter-speech>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `src` (`src`) | `string \| null` | The recording of the learner as a data URL, or `null` if nothing was recorded yet. | `null` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `reset` | - | -
| `checkValidity` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterText` (`<webwriter-text>`)
An answer where learners type a value into an input field.

It must be assigned to the default slot of a `<webwriter-task>`.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-text.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-text.js"></script>
<webwriter-text></webwriter-text>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-text.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-text.js"></script>
<webwriter-text></webwriter-text>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `type` (`type`) | `TextType` | The kind of input field learners answer in.<br><br>- `long-text`: A multi-line text area.<br>- `text`: A single-line text field.<br>- `number`: A number field.<br>- `date`: A date picker.<br>- `time`: A time picker.<br>- `datetime-local`: A combined date and time picker. | `"long-text"` | ✓ |
| `placeholder` (`placeholder`) | `string` | The placeholder shown while the field is empty. | `""` | ✓ |
| `freeText` (`free-text`) | `boolean` | Whether any non-empty answer counts as correct, without comparing it to the solution. | `false` | ✓ |
| `ignoreCase` (`ignore-case`) | `boolean` | Whether the answer is compared to the solution case-insensitively. | `false` | ✓ |
| `correctMessage` (`correct-message`) | `string` | The feedback shown after submitting if the answer is correct. | `""` | ✓ |
| `wrongMessage` (`wrong-message`) | `string` | The feedback shown after submitting if the answer is wrong. | `""` | ✓ |
| `solution` (`solution`) | `string` | The value counting as correct. It is obfuscated in the markup so that learners cannot read it directly. | `""` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `focus` | - | -
| `checkValidity` | - | -
| `reset` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebWriterMark` (`<webwriter-mark>`)
An answer where learners mark the words of a text that fit the question.

The text must be assigned to the default slot; the element itself must be
assigned to the default slot of a `<webwriter-task>`.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-mark.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-mark.js"></script>
<webwriter-mark></webwriter-mark>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-mark.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-mark.js"></script>
<webwriter-mark></webwriter-mark>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `gradingMethod` (`grading-method`) | `MarkGradingMethod` | How the score of this answer is calculated.<br><br>- `pass-fail`: Full score only if exactly the correct words are marked.<br>- `partial`: Correctly marked words earn credit, wrong ones subtract from it. | `"pass-fail"` | ✓ |
| `solution` (`solution`) | `number[]` | The indices of the word-like segments counting as correct. It is obfuscated in the markup so that learners cannot read it directly. | `[]` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`
| `reset` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterGap` (`<webwriter-gap>`)
An answer where learners fill the gaps in a text.

The text must be assigned to the default slot, with a `<webwriter-gap-item>`
in place of each gap.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-gap.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-gap.js"></script>
<webwriter-gap></webwriter-gap>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-gap.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-gap.js"></script>
<webwriter-gap></webwriter-gap>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `mode` (`mode`) | `GapMode` | How learners fill the gaps.<br><br>- `input`: Each gap is a text field learners type into.<br>- `drag-and-drop`: The gaps are filled from a shared pool of draggable answers. | `"input"` | ✓ |
| `ignoreCase` (`ignore-case`) | `boolean` | Whether answers are compared to the solution case-insensitively. Only applies in `input` mode. | `false` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `reset` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Events
| Name | Description |
| :--: | :---------: |
| change | Dispatched when learners move an answer into or out of a gap. Only in `drag-and-drop` mode. |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, custom CSS properties, or CSS parts.*


## `WebwriterGapItem` (`<webwriter-gap-item>`)
A single gap of a `<webwriter-gap>`, whose content is the correct answer.

It must be placed inside the text assigned to the default slot of its parent
element.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-gap-item.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-gap-item.js"></script>
<webwriter-gap-item></webwriter-gap-item>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-gap-item.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-gap-item.js"></script>
<webwriter-gap-item></webwriter-gap-item>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `placeholder` (`placeholder`) | `string` | The placeholder shown while the gap is empty. Only applies in `input` mode. | `""` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterPairing` (`<webwriter-pairing>`)
An answer where learners match items into pairs.

The items must be `<webwriter-pairing-item>` children of this element.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-pairing.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-pairing.js"></script>
<webwriter-pairing></webwriter-pairing>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-pairing.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-pairing.js"></script>
<webwriter-pairing></webwriter-pairing>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `mode` (`mode`) | `PairingMode` | How learners match the items.<br><br>- `pairing`: All items are visible and learners drag them together.<br>- `memory`: The items are face down and learners uncover two at a time. | `"pairing"` | ✓ |
| `solution` (`solution`) | `[string, string][]` | The pairs counting as correct, as tuples of the two item IDs. It is obfuscated in the markup so that learners cannot read it directly. | `[]` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `checkValidity` | - | -
| `checkAnswer` | - | `detailedFeedback: boolean`
| `reset` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterPairing` (`<webwriter-pairing-item>`)
A single item of a `<webwriter-pairing>`.

It must be a child of its parent element.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-pairing-item.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/quiz/widgets/webwriter-pairing-item.js"></script>
<webwriter-pairing-item></webwriter-pairing-item>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/quiz
```

```html
<link href="@webwriter/quiz/widgets/webwriter-pairing-item.css" rel="stylesheet">
<script type="module" src="@webwriter/quiz/widgets/webwriter-pairing-item.js"></script>
<webwriter-pairing-item></webwriter-pairing-item>
```

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public fields, methods, slots, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.9.1*