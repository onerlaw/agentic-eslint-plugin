import markdownMapCodeStyles from "./rules/markdown-map-code-styles.js";
import noBiomeIgnore from "./rules/no-biome-ignore.js";
import noCredentialInUrl from "./rules/no-credential-in-url.js";
import oneExportPerFile from "./rules/one-export-per-file.js";
import qualityModelTokenFloor from "./rules/quality-model-token-floor.js";
import responsiveTwoPaneFlex from "./rules/responsive-two-pane-flex.js";
import rpcErrorStandard from "./rules/rpc-error-standard.js";
import tamaguiNativeId from "./rules/tamagui-native-id.js";
import workspaceChromeFlex from "./rules/workspace-chrome-flex.js";
import workspaceRuntimeImports from "./rules/workspace-runtime-imports.js";

// Each rule's `meta.docs.description` states what it guards; the long form —
// why it exists, its false-positive bias, and its known blind spots — lives in
// docs/rules/<name>.md, which `meta.docs.url` points at.
//
// No `recommended` config is exported, deliberately. These rules walk
// genuinely different file sets, and reusing one flat-config block silently
// unguards whatever that block ignores. The README gives per-rule config
// recipes instead of a preset that would paper over the difference.
export default {
  meta: { name: "@onerlaw/agentic-eslint-plugin" },
  rules: {
    "markdown-map-code-styles": markdownMapCodeStyles,
    "no-biome-ignore": noBiomeIgnore,
    "no-credential-in-url": noCredentialInUrl,
    "one-export-per-file": oneExportPerFile,
    "quality-model-token-floor": qualityModelTokenFloor,
    "responsive-two-pane-flex": responsiveTwoPaneFlex,
    "rpc-error-standard": rpcErrorStandard,
    "tamagui-native-id": tamaguiNativeId,
    "workspace-chrome-flex": workspaceChromeFlex,
    "workspace-runtime-imports": workspaceRuntimeImports,
  },
};
