import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: ["esm"],
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  minify: true,
  bundle: true,
  platform: "node",
  target: "node22",
});
