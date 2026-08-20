import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/markdown-map-code-styles.js";

const OPTIONS = [{ markerImport: "FONT_STYLES", builder: "buildCodeStyles" }];

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

// The four real maps, by path, so a case reads as the file it stands for.
const CHAT = "packages/web/src/components/chat/chat-markdown-styles.ts";
const NOTES =
  "packages/web/src/components/screens/scratch-notes/scratch-note-markdown-styles.ts";
const JOB = "packages/web/src/components/screens/detail/detail-styles.ts";
const LEGAL = "packages/web/src/components/screens/legal/legal-document-styles.ts";

const IMPORTS = `import { buildCodeStyles } from "@/lib/markdown-code";
import { FONT_STYLES } from "@/lib/markdown-fonts";`;

ruleTester.run("markdown-map-code-styles", rule, {
  valid: [
    {
      options: OPTIONS,
      name: "the canonical shape — spread the builder's result beside the font styles",
      filename: CHAT,
      code: `${IMPORTS}
export function buildChatMarkdownStyles(theme) {
  const code = buildCodeStyles(theme, { fontSize: 13, lineHeight: 22 });
  return { ...FONT_STYLES, ...code, body: { fontSize: 14 } };
}`,
    },
    {
      options: OPTIONS,
      // The notes preview's real shape: it takes the shared rules and then overrides two
      // of them. That is the sanctioned way to differ, so it must not be reported — a
      // rule that flagged a hand-written `code_block` key would have failed here.
      name: "post-spread overrides are allowed",
      filename: NOTES,
      code: `${IMPORTS}
export function buildScratchNoteMarkdownStyles(theme) {
  const code = buildCodeStyles(theme, { fontSize: 13, lineHeight: 24 });
  return {
    ...FONT_STYLES,
    ...code,
    code_block: { ...code.code_block, borderWidth: 0, padding: 8 },
    fence: { ...code.fence, borderWidth: 0, padding: 8 },
  };
}`,
    },
    {
      options: OPTIONS,
      // The builder's own module, and anything else that imports neither constant, is
      // simply not a markdown style map.
      name: "a file importing neither constant is out of scope",
      filename: "packages/web/src/lib/markdown-code.ts",
      code: `import { MARKDOWN_CODE_FONT_STYLE } from "./markdown-font-styles";
export function buildCodeStyles(theme, metrics) {
  return { code_inline: { ...MARKDOWN_CODE_FONT_STYLE, padding: 0, lineHeight: metrics.lineHeight } };
}`,
    },
    {
      options: OPTIONS,
      // The import may be aliased locally; `imported` is the name in the source module,
      // which is what the rule keys on.
      name: "an aliased import still counts as using the builder",
      filename: JOB,
      code: `import { buildCodeStyles as buildCode } from "@/lib/markdown-code";
import { FONT_STYLES } from "@/lib/markdown-fonts";
export function buildMarkdownStyles(theme) {
  return { ...FONT_STYLES, ...buildCode(theme, { fontSize: 13, lineHeight: 22 }) };
}`,
    },
  ],
  invalid: [
    {
      options: OPTIONS,
      // The shape two surfaces shipped: the font spread and nothing else, so every
      // code rule came from the library — an unthemed grey chip with a light border,
      // which on a dark page is a bright rectangle.
      name: "a map that supplies no code rules at all",
      filename: LEGAL,
      code: `import { FONT_STYLES } from "@/lib/markdown-fonts";
export function buildLegalMarkdownStyles(theme) {
  return { ...FONT_STYLES, body: { fontSize: 16, lineHeight: 26 } };
}`,
      errors: [{ messageId: "missingCodeStyles" }],
    },
    {
      options: OPTIONS,
      // The reported defect itself: code rules written by hand, with the longhand that
      // does not displace the library's `padding: 10`. Hand-rolling is exactly what the
      // rule exists to stop, whether or not the author remembered a background colour.
      name: "hand-rolled code rules instead of the shared builder",
      filename: NOTES,
      code: `import { FONT_STYLES } from "@/lib/markdown-fonts";
export function buildScratchNoteMarkdownStyles(theme) {
  return {
    ...FONT_STYLES,
    code_inline: { backgroundColor: theme.surface, paddingHorizontal: 4, borderRadius: 3 },
  };
}`,
      errors: [{ messageId: "missingCodeStyles" }],
    },
    {
      options: OPTIONS,
      // The case the rule is actually for: a FIFTH map, in a file no hand-written test
      // block enumerates.
      name: "a new surface that nobody has added a test block for",
      filename: "packages/web/src/components/screens/notes/release-notes-styles.ts",
      code: `import { FONT_STYLES } from "@/lib/markdown-fonts";
export function buildReleaseNotesStyles(theme) {
  return { ...FONT_STYLES, body: { color: theme.foreground } };
}`,
      errors: [{ messageId: "missingCodeStyles" }],
    },
  ],
});
