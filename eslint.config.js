import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";


export default [
  {languageOptions: { globals: globals.browser }},
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    rules: {
      ...pluginReactConfig.rules,
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    ignores: ["_pages/", "dist/"]
  }
];
