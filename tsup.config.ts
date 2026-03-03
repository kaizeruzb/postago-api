import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: false,
  external: ["@prisma/client"],
  noExternal: ["@postago/shared"],
  clean: true,
});
