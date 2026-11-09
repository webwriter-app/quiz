import { createRequire } from "node:module";

// WebWriter's release command builds widget entries. Use its bundler for the
// task base class and browser tests as well, with the same browser target.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("@webwriter/build/test"))("esbuild");

await build({
	entryPoints: { task: "src/widgets/webwriter-task.ts", "tests/quiz": "src/tests/quiz.ts" },
	outdir: "dist",
	bundle: true,
	format: "esm",
	target: "es2022",
	loader: { ".svg": "dataurl" },
});
