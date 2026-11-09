import { createRequire } from "node:module";

// WebWriter's release command builds widget entries. Use its bundler for the
// migration and browser tests as well, with the same browser target.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("@webwriter/build/test"))("esbuild");

await build({
	entryPoints: { migrate: "src/migrate/index.ts", "tests/quiz": "src/tests/quiz.ts" },
	outdir: "dist",
	bundle: true,
	format: "esm",
	target: "es2022",
	loader: { ".svg": "dataurl" },
});
