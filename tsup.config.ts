import { defineConfig } from "tsup";
import type { Options } from "tsup";

const shared: Options = {
  format: ["cjs", "esm"],
  dts: true,
  clean: false, // dist/ is cleared by the "prebuild" script
  sourcemap: true,
  minify: false,
  target: "es2020",
  external: ["react"],
};

export default defineConfig([
  { ...shared, entry: { index: "src/index.ts" } },
  {
    ...shared,
    entry: { react: "src/react.ts" },
    banner: { js: "'use client';" },
  },
]);
