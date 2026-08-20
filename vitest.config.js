import { defineConfig } from "vitest/config";

// RuleTester needs describe/it as globals.
export default defineConfig({
  test: { globals: true, root: ".", include: ["tests/**/*.test.js"] },
});
