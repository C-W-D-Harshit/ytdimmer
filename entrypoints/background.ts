import { browser } from "wxt/browser";
import { getSettings, initializeSettings, saveSettings } from "../lib/settings";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void initializeSettings();
  });

  void initializeSettings();

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-protection") return;
    const settings = await getSettings();
    await saveSettings({ enabled: !settings.enabled });
  });
});
