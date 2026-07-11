import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  manifest: {
    name: "YT Dimmer",
    description:
      "Softens sudden flashes and bright video scenes for more comfortable viewing.",
    permissions: ["storage", "activeTab"],
    commands: {
      "toggle-protection": {
        suggested_key: {
          default: "Alt+Shift+D",
          mac: "Alt+Shift+D",
        },
        description: "Toggle YT Dimmer protection",
      },
    },
  },
});
