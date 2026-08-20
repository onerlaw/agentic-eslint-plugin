import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/responsive-two-pane-flex.js";

const SCREEN = "packages/web/src/components/screens/account/account-content.tsx";
const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// The three file-scoped signals that gate this rule. Without ALL of them the
// rule stays silent — that gate is what stops it banning a universally correct
// RN idiom.
const SIGNALS = `
const ROW = { flexDirection: "row" };
export const Shell = () => <View flexDirection="column" $gtMd={ROW} />;
`;

ruleTester.run("responsive-two-pane-flex", rule, {
  valid: [
    {
      name: "flex={1} in a file with NO two-pane signals is untouched",
      filename: SCREEN,
      code: "export const A = () => <View flex={1} />;",
    },
    {
      name: "column container but no row switch — not a two-pane screen",
      filename: SCREEN,
      code: 'export const A = () => <View flexDirection="column" flex={1} />;',
    },
    {
      name: "the CORRECT guarded form: flex behind the same breakpoint",
      filename: SCREEN,
      code: `${SIGNALS}
const CONTENT_PANE_GTMD = { flex: 1 };
export const B = () => <View minWidth={0} $gtMd={CONTENT_PANE_GTMD} />;`,
    },
    {
      name: "inline $gtMd={{ flex: 1 }} is guarded",
      filename: SCREEN,
      code: `${SIGNALS}
export const B = () => <View $gtMd={{ flex: 1 }} />;`,
    },
    {
      name: "ScrollView is exempt — the scroll chain needs flex 1 on web",
      filename: SCREEN,
      code: `${SIGNALS}
export const B = () => <ScrollView flex={1} />;`,
    },
    {
      name: "SafeAreaView and KeyboardAvoidingView are exempt too",
      filename: SCREEN,
      code: `${SIGNALS}
export const B = () => <SafeAreaView flex={1}><KeyboardAvoidingView flex={1} /></SafeAreaView>;`,
    },
    {
      name: "styled() of an exempt tag",
      filename: SCREEN,
      code: `${SIGNALS}
const Scroller = styled(ScrollView, { flex: 1 });
export const B = Scroller;`,
    },
    {
      name: "flex: 2 is not the unconditional-collapse form this rule targets",
      filename: SCREEN,
      code: `${SIGNALS}
export const B = () => <View flex={2} />;`,
    },
  ],

  invalid: [
    {
      // FORM 1 — the inline spelling. Reproduces units 346/471.
      name: "inline flex={1} in a responsive two-pane screen",
      filename: SCREEN,
      code: `${SIGNALS}
export const B = () => <View flex={1} minWidth={0} />;`,
      errors: [{ messageId: "collapsingFlex" }],
    },
    {
      // FORM 2 — the styled() pane. The script's own header calls this the
      // LIKELIER next spelling, because AGENTS.md tells developers to prefer
      // styled() for recurring prop combinations.
      name: "styled() pane with an unconditional flex: 1",
      filename: SCREEN,
      code: `${SIGNALS}
const Pane = styled(View, { flex: 1, minWidth: 0 });
export const B = Pane;`,
      errors: [{ messageId: "collapsingFlex" }],
    },
    {
      name: "both forms in one file report twice",
      filename: SCREEN,
      code: `${SIGNALS}
const Pane = styled(View, { flex: 1 });
export const B = () => <View flex={1} />;
export const C = Pane;`,
      errors: [{ messageId: "collapsingFlex" }, { messageId: "collapsingFlex" }],
    },
    {
      name: "signals may appear AFTER the offending flex — Program:exit ordering",
      filename: SCREEN,
      code: `export const B = () => <View flex={1} />;
${SIGNALS}`,
      errors: [{ messageId: "collapsingFlex" }],
    },
  ],
});
