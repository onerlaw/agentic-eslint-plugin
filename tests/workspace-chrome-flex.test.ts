import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/workspace-chrome-flex.js";

const IN_CHROME = "packages/web/src/components/workspace/workspace-pane-style.ts";
const ALLOWED = [{ allow: ["/workspace/pane-toggle-segment.tsx", "/workspace/pane-header.tsx"] }];
const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run("workspace-chrome-flex", rule, {
  valid: [
    {
      name: "flexGrow keeps basis auto — the sanctioned fill",
      filename: IN_CHROME,
      code: "export const PANE_FILL = { flexGrow: 1, flexShrink: 1 };",
    },
    {
      name: "guarded inside a $gtMd object",
      filename: IN_CHROME,
      code: "export const PANE = { minWidth: 0, $gtMd: { flex: 1 } };",
    },
    {
      name: "guarded by the load-bearing *_GTMD const suffix",
      filename: IN_CHROME,
      code: "export const PRIMARY_PANE_GTMD = { flex: 3 };",
    },
    {
      name: "guarded as a JSX $gtMd attribute",
      filename: "packages/web/src/components/workspace/pane-title.tsx",
      code: "export const A = () => <View $gtMd={{ flex: 1 }} />;",
    },
    {
      name: "allowlisted row child: pane-toggle-segment",
      filename: "packages/web/src/components/workspace/pane-toggle-segment.tsx",
      options: ALLOWED,
      code: "export const A = () => <XStack flex={1} />;",
    },
    {
      name: "allowlisted row child: pane-header",
      filename: "packages/web/src/components/workspace/pane-header.tsx",
      options: ALLOWED,
      code: "export const A = () => <XStack flex={1} />;",
    },
  ],

  invalid: [
    {
      // THE REPRODUCTION TARGET for this rule. No shipped incident exists at this
      // location — the guard was added proactively when a reviewer noticed the
      // extraction would make the sibling rule go blind — so the fixture is
      // synthetic by necessity, and that asymmetry is stated in the proposal.
      name: "bare flex: 1 in the shared style module",
      filename: IN_CHROME,
      code: "export const PANE_FILL = { flex: 1, minWidth: 0 };",
      errors: [{ messageId: "unguardedFlex" }],
    },
    {
      // ANY factor, not just 1 — `flex: N` sets a basis of 0 for every N.
      name: "flex: 3 is equally collapsing",
      filename: IN_CHROME,
      code: "export const PANE = { flex: 3 };",
      errors: [{ messageId: "unguardedFlex" }],
    },
    {
      name: "inline JSX flex={2} in the chrome",
      filename: "packages/web/src/components/workspace/pane-switcher.tsx",
      code: "export const A = () => <YStack flex={2} />;",
      errors: [{ messageId: "unguardedFlex" }],
    },
    {
      name: "a non-allowlisted file gets no exemption",
      filename: "packages/web/src/components/workspace/pane-compact-menu.tsx",
      options: ALLOWED,
      code: "export const A = () => <XStack flex={1} />;",
      errors: [{ messageId: "unguardedFlex" }],
    },
    {
      // The suffix is load-bearing: a breakpoint-shaped object named WITHOUT it
      // is not recognised as guarded, by design.
      name: "breakpoint-shaped const lacking the _GTMD suffix is not forgiven",
      filename: IN_CHROME,
      code: "export const PRIMARY_PANE = { flex: 3 };",
      errors: [{ messageId: "unguardedFlex" }],
    },
  ],
});
