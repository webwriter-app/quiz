/**
 * Synchronous reimplementation of the solution encryption used by
 * `@webwriter/quiz` v1, which stored every answer's solution on
 * `<webwriter-task>` as `solution`/`salt`/`iv` data URLs. The payload was
 * PBKDF2-SHA-256 (100000 iterations) derived from a hardcoded password and
 * encrypted with AES-256-GCM.
 *
 * WebWriter runs migration scripts in an iframe and snapshots the document as
 * soon as it loads, so the `migrate` handler cannot await anything. That rules
 * out `crypto.subtle`, hence the hand-rolled primitives below. Only the
 * AES-CTR half of GCM is implemented: the authentication tag is discarded
 * rather than verified, which is fine because a wrong plaintext simply fails to
 * parse as JSON.
 */

/** The password v1 hardcoded in `webwriter-task.ts`. */
const LEGACY_PASSWORD = "B08bxd82SAOf";
const PBKDF2_ITERATIONS = 100000;
const GCM_TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

const K = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
	0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
	0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
	0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
	0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
	0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
	0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
	0xc67178f2,
]);

const INITIAL_STATE = new Uint32Array([
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const schedule = new Uint32Array(64);

function compress(state: Uint32Array, block: Uint8Array, offset: number) {
	for (let i = 0; i < 16; i++) {
		const j = offset + i * 4;
		schedule[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
	}

	for (let i = 16; i < 64; i++) {
		const x = schedule[i - 15];
		const y = schedule[i - 2];
		const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
		const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
		schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) | 0;
	}

	let a = state[0];
	let b = state[1];
	let c = state[2];
	let d = state[3];
	let e = state[4];
	let f = state[5];
	let g = state[6];
	let h = state[7];

	for (let i = 0; i < 64; i++) {
		const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
		const ch = (e & f) ^ (~e & g);
		const t1 = (h + s1 + ch + K[i] + schedule[i]) | 0;
		const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
		const maj = (a & b) ^ (a & c) ^ (b & c);
		const t2 = (s0 + maj) | 0;

		h = g;
		g = f;
		f = e;
		e = (d + t1) | 0;
		d = c;
		c = b;
		b = a;
		a = (t1 + t2) | 0;
	}

	state[0] = (state[0] + a) | 0;
	state[1] = (state[1] + b) | 0;
	state[2] = (state[2] + c) | 0;
	state[3] = (state[3] + d) | 0;
	state[4] = (state[4] + e) | 0;
	state[5] = (state[5] + f) | 0;
	state[6] = (state[6] + g) | 0;
	state[7] = (state[7] + h) | 0;
}

const tailBlock = new Uint8Array(128);
const tailView = new DataView(tailBlock.buffer);

/** Feeds `data` into `state`, finishing the hash of `prefixLength` earlier bytes plus `data`. */
function absorb(state: Uint32Array, data: Uint8Array, prefixLength: number) {
	let i = 0;
	for (; i + 64 <= data.length; i += 64) compress(state, data, i);

	const rest = data.length - i;
	const size = rest <= 55 ? 64 : 128;
	tailBlock.fill(0, 0, size);
	tailBlock.set(data.subarray(i), 0);
	tailBlock[rest] = 0x80;

	const bits = (prefixLength + data.length) * 8;
	tailView.setUint32(size - 8, Math.floor(bits / 0x100000000));
	tailView.setUint32(size - 4, bits >>> 0);

	for (let j = 0; j < size; j += 64) compress(state, tailBlock, j);
}

function writeState(state: Uint32Array, out: Uint8Array) {
	for (let i = 0; i < 8; i++) {
		out[i * 4] = state[i] >>> 24;
		out[i * 4 + 1] = (state[i] >>> 16) & 0xff;
		out[i * 4 + 2] = (state[i] >>> 8) & 0xff;
		out[i * 4 + 3] = state[i] & 0xff;
	}
}

function sha256(data: Uint8Array) {
	const state = INITIAL_STATE.slice();
	absorb(state, data, 0);
	const out = new Uint8Array(32);
	writeState(state, out);
	return out;
}

// ---------------------------------------------------------------------------
// HMAC-SHA-256 and PBKDF2
// ---------------------------------------------------------------------------

type HmacStates = { inner: Uint32Array; outer: Uint32Array };

/** Precomputes the two padded-key states so each HMAC costs two compressions. */
function hmacStates(key: Uint8Array): HmacStates {
	const normalized = key.length > 64 ? sha256(key) : key;
	const ipad = new Uint8Array(64);
	const opad = new Uint8Array(64);
	ipad.set(normalized);
	opad.set(normalized);

	for (let i = 0; i < 64; i++) {
		ipad[i] ^= 0x36;
		opad[i] ^= 0x5c;
	}

	const inner = INITIAL_STATE.slice();
	compress(inner, ipad, 0);
	const outer = INITIAL_STATE.slice();
	compress(outer, opad, 0);
	return { inner, outer };
}

const hmacDigest = new Uint8Array(32);

function hmacInto(states: HmacStates, message: Uint8Array, out: Uint8Array) {
	const inner = states.inner.slice();
	absorb(inner, message, 64);
	writeState(inner, hmacDigest);

	const outer = states.outer.slice();
	absorb(outer, hmacDigest, 64);
	writeState(outer, out);
}

function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, keyLength: number) {
	const states = hmacStates(password);
	const derived = new Uint8Array(keyLength);
	const input = new Uint8Array(salt.length + 4);
	const inputView = new DataView(input.buffer);
	const u = new Uint8Array(32);
	const t = new Uint8Array(32);
	input.set(salt);

	for (let block = 1; block <= Math.ceil(keyLength / 32); block++) {
		inputView.setUint32(salt.length, block);
		hmacInto(states, input, u);
		t.set(u);

		for (let i = 1; i < iterations; i++) {
			hmacInto(states, u, u);
			for (let j = 0; j < 32; j++) t[j] ^= u[j];
		}

		derived.set(t.subarray(0, Math.min(32, keyLength - (block - 1) * 32)), (block - 1) * 32);
	}

	return derived;
}

// ---------------------------------------------------------------------------
// AES-256 in counter mode
// ---------------------------------------------------------------------------

const SBOX = new Uint8Array(256);

{
	const rotl8 = (x: number, shift: number) => ((x << shift) | (x >>> (8 - shift))) & 0xff;
	let p = 1;
	let q = 1;

	do {
		p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 0xff;
		q ^= q << 1;
		q ^= q << 2;
		q ^= q << 4;
		q &= 0xff;
		if (q & 0x80) q ^= 0x09;
		SBOX[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 0xff;
	} while (p !== 1);

	SBOX[0] = 0x63;
}

const xtime = (x: number) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;

const AES_ROUNDS = 14;
const AES_KEY_WORDS = 8;

function expandKey(key: Uint8Array) {
	const roundKeys = new Uint8Array(16 * (AES_ROUNDS + 1));
	roundKeys.set(key);
	let rcon = 1;

	for (let i = AES_KEY_WORDS; i < 4 * (AES_ROUNDS + 1); i++) {
		const previous = (i - 1) * 4;
		let t0 = roundKeys[previous];
		let t1 = roundKeys[previous + 1];
		let t2 = roundKeys[previous + 2];
		let t3 = roundKeys[previous + 3];

		if (i % AES_KEY_WORDS === 0) {
			const rotated = t0;
			t0 = SBOX[t1] ^ rcon;
			t1 = SBOX[t2];
			t2 = SBOX[t3];
			t3 = SBOX[rotated];
			rcon = xtime(rcon);
		} else if (i % AES_KEY_WORDS === 4) {
			t0 = SBOX[t0];
			t1 = SBOX[t1];
			t2 = SBOX[t2];
			t3 = SBOX[t3];
		}

		const target = i * 4;
		const source = (i - AES_KEY_WORDS) * 4;
		roundKeys[target] = roundKeys[source] ^ t0;
		roundKeys[target + 1] = roundKeys[source + 1] ^ t1;
		roundKeys[target + 2] = roundKeys[source + 2] ^ t2;
		roundKeys[target + 3] = roundKeys[source + 3] ^ t3;
	}

	return roundKeys;
}

function encryptBlock(roundKeys: Uint8Array, block: Uint8Array) {
	for (let i = 0; i < 16; i++) block[i] ^= roundKeys[i];

	for (let round = 1; round <= AES_ROUNDS; round++) {
		for (let i = 0; i < 16; i++) block[i] = SBOX[block[i]];

		let swap = block[1];
		block[1] = block[5];
		block[5] = block[9];
		block[9] = block[13];
		block[13] = swap;

		swap = block[2];
		const swap2 = block[6];
		block[2] = block[10];
		block[6] = block[14];
		block[10] = swap;
		block[14] = swap2;

		swap = block[15];
		block[15] = block[11];
		block[11] = block[7];
		block[7] = block[3];
		block[3] = swap;

		if (round < AES_ROUNDS) {
			for (let c = 0; c < 16; c += 4) {
				const a0 = block[c];
				const a1 = block[c + 1];
				const a2 = block[c + 2];
				const a3 = block[c + 3];
				const all = a0 ^ a1 ^ a2 ^ a3;
				block[c] = a0 ^ all ^ xtime(a0 ^ a1);
				block[c + 1] = a1 ^ all ^ xtime(a1 ^ a2);
				block[c + 2] = a2 ^ all ^ xtime(a2 ^ a3);
				block[c + 3] = a3 ^ all ^ xtime(a3 ^ a0);
			}
		}

		const offset = round * 16;
		for (let i = 0; i < 16; i++) block[i] ^= roundKeys[offset + i];
	}
}

/** AES-256-GCM decryption without tag verification (GCM is CTR plus a MAC we ignore). */
function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, payload: Uint8Array) {
	if (iv.length !== 12) throw new Error(`Unsupported IV length: ${iv.length}`);
	if (payload.length < GCM_TAG_LENGTH) throw new Error("Ciphertext too short");

	const roundKeys = expandKey(key);
	const ciphertext = payload.subarray(0, payload.length - GCM_TAG_LENGTH);
	const plaintext = new Uint8Array(ciphertext.length);
	const counter = new Uint8Array(16);
	const keystream = new Uint8Array(16);
	counter.set(iv);
	counter[15] = 1;

	for (let offset = 0; offset < ciphertext.length; offset += 16) {
		for (let i = 15; i >= 12; i--) {
			counter[i] = (counter[i] + 1) & 0xff;
			if (counter[i] !== 0) break;
		}

		keystream.set(counter);
		encryptBlock(roundKeys, keystream);

		const length = Math.min(16, ciphertext.length - offset);
		for (let i = 0; i < length; i++) plaintext[offset + i] = ciphertext[offset + i] ^ keystream[i];
	}

	return plaintext;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function dataUrlToBytes(url: string) {
	const comma = url.indexOf(",");
	if (comma === -1) throw new Error("Not a data URL");

	const payload = url.slice(comma + 1);

	if (!/;base64/i.test(url.slice(0, comma))) {
		return new TextEncoder().encode(decodeURIComponent(payload));
	}

	const binary = atob(payload);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Decrypts the `solution`/`iv`/`salt` triple of a v1 `<webwriter-task>` and
 * returns the answer element's solution value, or `undefined` if the task
 * carries no (readable) solution.
 */
export function decryptLegacySolution(solution: string, iv: string, salt: string): unknown {
	const key = pbkdf2Sha256(new TextEncoder().encode(LEGACY_PASSWORD), dataUrlToBytes(salt), PBKDF2_ITERATIONS, 32);
	const plaintext = aesGcmDecrypt(key, dataUrlToBytes(iv), dataUrlToBytes(solution));
	return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
}
