// Config ESLint (flat, ESLint 9) — objectif principal : `no-undef`, qui attrape
// les variables non déclarées (ex. le bug `downloadModal is not defined` qui
// cassait toute l'initialisation). Lancé en CI (Node absent en local).
const globals = require("globals");

module.exports = [
  {
    files: ["web/static/main.js", "web/static/lang.js", "web/static/js/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Globals externes / partagés entre fichiers
        Hls: "readonly",          // hls.js (CDN)
        t: "readonly",            // helper i18n défini dans lang.js
        setLanguage: "readonly",  // défini dans lang.js
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
    },
  },
  {
    files: ["web/static/sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
    rules: { "no-undef": "error" },
  },
];
