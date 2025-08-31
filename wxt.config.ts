import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Flash Guard",
    description:
      "Automatically detects and dims bright flashes and white pages to prevent eye strain",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["*.js", "*.css"],
        matches: ["<all_urls>"],
      },
    ],
  },
});
