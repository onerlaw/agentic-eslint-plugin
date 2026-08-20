import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/tamagui-native-id.js";

const F = "packages/frontend/src/components/screens/account/probe.tsx";
const OPTIONS = [{ forwarders: { "@/components/ui/text-input": ["TextInput"], "./text-input": ["TextInput"] } }];

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run("tamagui-native-id", rule, {
  valid: [
    {
      options: OPTIONS,
      name: "react-native View — nativeID genuinely reaches the DOM",
      filename: F,
      code: 'import { View } from "react-native";\nexport const A = () => <View nativeID="clerk-captcha" />;',
    },
    {
      options: OPTIONS,
      name: "aliased react-native import still counts",
      filename: F,
      code: 'import { View as RNView } from "react-native";\nexport const A = () => <RNView nativeID="clerk-captcha" />;',
    },
    {
      options: OPTIONS,
      name: "namespace import — RN.View resolves through the root identifier",
      filename: F,
      code: 'import * as RN from "react-native";\nexport const A = () => <RN.View nativeID="x" />;',
    },
    {
      options: OPTIONS,
      name: "default import binds too",
      filename: F,
      code: 'import RN from "react-native";\nexport const A = () => <RN nativeID="x" />;',
    },
    {
      options: OPTIONS,
      // The forwarder allowance, at parity with the script — keyed by
      // (specifier, export name), not specifier alone.
      name: "ui/text-input forwards onto RN's TextInput",
      filename: F,
      code: 'import { TextInput } from "@/components/ui/text-input";\nexport const A = () => <TextInput nativeID="search" />;',
    },
    {
      options: OPTIONS,
      name: "relative spelling of the same forwarder",
      filename: F,
      code: 'import { TextInput } from "./text-input";\nexport const A = () => <TextInput nativeID="search" />;',
    },
    {
      options: OPTIONS,
      name: "the sanctioned prop on a Tamagui component",
      filename: F,
      code: 'import { View } from "tamagui";\nexport const A = () => <View id="anchor" />;',
    },
  ],

  invalid: [
    {
      options: OPTIONS,
      // THE REPRODUCTION TARGET — units 363 (Clerk CAPTCHA) and 512 (/account rail).
      name: "Tamagui View carrying nativeID",
      filename: F,
      code: 'import { View } from "tamagui";\nexport const A = () => <View nativeID="account-section" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      name: "a local styled() wrapper — where the bug actually lives",
      filename: F,
      code: 'import { View, styled } from "tamagui";\nconst Pane = styled(View, {});\nexport const A = () => <Pane nativeID="anchor" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      name: "an unbound tag is flagged — default-deny, the pinned polarity",
      filename: F,
      code: 'export const A = () => <Mystery nativeID="x" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      // Parity check on the forwarder map's KEYING: only the listed export name
      // inherits the allowance, not every export of that module.
      name: "a DIFFERENT export from the forwarder module gets no allowance",
      filename: F,
      code: 'import { Something } from "@/components/ui/text-input";\nexport const A = () => <Something nativeID="x" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      name: "type-only react-native import binds no value",
      filename: F,
      code: 'import type { View } from "react-native";\nexport const A = () => <View nativeID="x" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      name: "inline type specifier binds no value either",
      filename: F,
      code: 'import { type View } from "react-native";\nexport const A = () => <View nativeID="x" />;',
      errors: [{ messageId: "droppedNativeId" }],
    },
    {
      options: OPTIONS,
      name: "imports appearing after the JSX are still resolved (Program:exit)",
      filename: F,
      code: 'export const A = () => <View nativeID="x" />;\nimport { View } from "tamagui";',
      errors: [{ messageId: "droppedNativeId" }],
    },
  ],
});
