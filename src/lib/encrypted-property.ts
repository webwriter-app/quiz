import {
	defaultConverter,
	type ComplexAttributeConverter,
	type ReactiveElement,
} from "lit";

const VERSION = 3;
const KEY_LENGTH = 16;
const LENGTH_LENGTH = 4;
const MIN_PADDING_LENGTH = 2;
const PADDING_BLOCK_LENGTH = 8;
const HEADER_LENGTH = 1 + KEY_LENGTH;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function randomBytes(length: number) {
	const bytes = new Uint8Array(length);

	if (globalThis.crypto?.getRandomValues) {
		return globalThis.crypto.getRandomValues(bytes);
	}

	// This converter only obfuscates values, so Math.random is an acceptable
	// fallback for environments without Web Crypto.
	for (let index = 0; index < length; index++) {
		bytes[index] = Math.floor(Math.random() * 256);
	}

	return bytes;
}

function paddedLength(plaintextLength: number) {
	const minimumLength = LENGTH_LENGTH + plaintextLength + MIN_PADDING_LENGTH;
	const roundedLength =
		Math.ceil(minimumLength / PADDING_BLOCK_LENGTH) * PADDING_BLOCK_LENGTH;

	// An occasional extra block prevents equal plaintext lengths from always
	// producing equal attribute lengths.
	return roundedLength + (randomBytes(1)[0] % 2) * PADDING_BLOCK_LENGTH;
}

function applyKeystream(bytes: Uint8Array, key: Uint8Array) {
	const result = new Uint8Array(bytes.length);
	const state = new Uint32Array(4);
	const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);

	for (let index = 0; index < state.length; index++) {
		state[index] = keyView.getUint32(index * 4);
	}

	if (state.every((word) => word === 0)) {
		state[0] = 1;
	}

	for (let index = 0; index < bytes.length; index++) {
		// xorshift128 produces a deterministic, non-repeating-looking byte
		// stream from the full random key.
		let next = state[3];
		const first = state[0];
		state[3] = state[2];
		state[2] = state[1];
		state[1] = first;
		next ^= next << 11;
		next ^= next >>> 8;
		state[0] = next ^ first ^ (first >>> 19);
		result[index] = bytes[index] ^ state[0];
	}

	return result;
}

function toBase64(bytes: Uint8Array) {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function fromBase64(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function decryptAttribute(value: string) {
	const payload = fromBase64(value);

	if (payload[0] !== VERSION || payload.length < HEADER_LENGTH + LENGTH_LENGTH) {
		throw new Error("Not an encrypted property");
	}

	const key = payload.subarray(1, HEADER_LENGTH);
	const framedPlaintext = applyKeystream(payload.subarray(HEADER_LENGTH), key);
	const plaintextLength = new DataView(
		framedPlaintext.buffer,
		framedPlaintext.byteOffset,
		framedPlaintext.byteLength,
	).getUint32(0);

	if (plaintextLength > framedPlaintext.length - LENGTH_LENGTH) {
		throw new Error("Invalid encrypted property");
	}

	return JSON.parse(
		decoder.decode(
			framedPlaintext.subarray(LENGTH_LENGTH, LENGTH_LENGTH + plaintextLength),
		),
	) as unknown;
}

export function isEncryptedProperty(value: string | null) {
	if (value === null) {
		return false;
	}

	try {
		decryptAttribute(value);
		return true;
	} catch {
		return false;
	}
}

/**
 * A Lit property converter that keeps plainly readable values out of HTML.
 *
 * The random key is stored alongside the encrypted value, so this deliberately
 * provides obfuscation rather than security. Plain attributes remain valid for
 * convenient authoring and are encrypted the next time the property reflects.
 */
export const encryptedProperty: ComplexAttributeConverter<unknown> = {
	toAttribute(value) {
		if (value == null) {
			return value;
		}

		const plaintext = encoder.encode(JSON.stringify(value));
		const framedPlaintext = randomBytes(paddedLength(plaintext.length));
		new DataView(framedPlaintext.buffer).setUint32(0, plaintext.length);
		framedPlaintext.set(plaintext, LENGTH_LENGTH);

		const key = randomBytes(KEY_LENGTH);
		const ciphertext = applyKeystream(framedPlaintext, key);
		const payload = new Uint8Array(HEADER_LENGTH + ciphertext.length);
		payload[0] = VERSION;
		payload.set(key, 1);
		payload.set(ciphertext, HEADER_LENGTH);

		return toBase64(payload);
	},

	fromAttribute(value, type) {
		if (value == null) {
			return null;
		}

		try {
			return decryptAttribute(value);
		} catch {
			return defaultConverter.fromAttribute?.(value, type);
		}
	},
};

/**
 * Encrypts human-authored plaintext attributes for properties using
 * `encryptedProperty`. Call this once from the element's `firstUpdated()`.
 */
export function encryptPlaintextAttributes(host: ReactiveElement) {
	const constructor = host.constructor as typeof ReactiveElement;

	for (const [property, options] of constructor.elementProperties) {
		if (options.converter !== encryptedProperty || options.attribute === false) {
			continue;
		}

		const attribute =
			typeof options.attribute === "string"
				? options.attribute
				: String(property).toLowerCase();
		const currentValue = host.getAttribute(attribute);

		if (currentValue !== null && !isEncryptedProperty(currentValue)) {
			const encryptedValue = encryptedProperty.toAttribute?.(
				host[property as keyof ReactiveElement],
				options.type,
			);

			if (typeof encryptedValue === "string") {
				host.setAttribute(attribute, encryptedValue);
			}
		}
	}
}
