import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // Function to update dim level based on time of day
  function updateDimLevelForTimeOfDay() {
    const now = new Date();
    const hour = now.getHours();
    // Day hours (6 AM to 8 PM): lighter dimming (0.3)
    // Night hours (8 PM to 6 AM): stronger dimming (0.5)
    const timeBasedDimLevel = (hour >= 6 && hour < 20) ? 0.3 : 0.5;
    
    browser.storage.sync.set({ ytDimmerDimLevel: timeBasedDimLevel });
  }

  // Initialize default settings
  browser.runtime.onInstalled.addListener(() => {
    browser.storage.sync.get([
      'ytDimmerEnabled', 
      'ytDimmerDimLevel',
      'ytDimmerBrightnessThreshold'
    ]).then((result) => {
      // Set defaults if not already set
      const defaults: Record<string, any> = {};
      
      if (result.ytDimmerEnabled === undefined) {
        defaults.ytDimmerEnabled = true;
      }
      
      if (result.ytDimmerDimLevel === undefined) {
        // Set default dim level based on time of day
        const now = new Date();
        const hour = now.getHours();
        // Day hours (6 AM to 8 PM): lighter default dimming (0.3)
        // Night hours (8 PM to 6 AM): stronger default dimming (0.5)
        defaults.ytDimmerDimLevel = (hour >= 6 && hour < 20) ? 0.3 : 0.5;
      }
      
      if (result.ytDimmerBrightnessThreshold === undefined) {
        defaults.ytDimmerBrightnessThreshold = 0.6;
      }
      
      if (Object.keys(defaults).length > 0) {
        browser.storage.sync.set(defaults);
      }
    });
  });

  // Update dim level on browser startup
  browser.runtime.onStartup.addListener(() => {
    updateDimLevelForTimeOfDay();
  });

  // Also update on extension startup (when browser starts or extension is enabled)
  updateDimLevelForTimeOfDay();

  // Handle messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSettings') {
      browser.storage.sync.get([
        'ytDimmerEnabled', 
        'ytDimmerDimLevel',
        'ytDimmerBrightnessThreshold'
      ]).then((result) => {
        sendResponse({
          enabled: result.ytDimmerEnabled !== false,
          dimLevel: result.ytDimmerDimLevel || 0.5,
          brightnessThreshold: result.ytDimmerBrightnessThreshold || 0.6
        });
      });
      return true; // Keep message channel open for async response
    }
    
    if (message.action === 'updateSettings') {
      browser.storage.sync.set(message.settings);
      sendResponse({ success: true });
    }
  });
});
