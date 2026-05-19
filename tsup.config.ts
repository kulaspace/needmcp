import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

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
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
