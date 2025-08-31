import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // name: "YTDimmer",
    // description:
    //   "Automatically detects and dims bright flashes in videos to prevent eye strain",
    permissions: ["storage"],
    host_permissions: [
      "*://www.youtube.com/*",
      "*://youtube.com/*",
      "*://www.twitch.tv/*",
      "*://twitch.tv/*",
      "*://vimeo.com/*",
      "*://www.vimeo.com/*",
    ],
    web_accessible_resources: [
      {
        resources: ["*.js", "*.css"],
        matches: ["<all_urls>"],
      },
    ],
  },
});
