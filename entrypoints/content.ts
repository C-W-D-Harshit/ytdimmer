import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let isEnabled = true;
    let dimLevel = 0.5; // How much to dim (0.1 = light, 0.9 = maximum)
    let brightnessThreshold = 0.6; // When to trigger dimming (0.1 = sensitive, 1.0 = only very bright)
    let currentVideo: HTMLVideoElement | null = null;
    let monitoringInterval: number | null = null;
    let currentDimLevel = 0;
    let lastBrightness = 0;
    let pageOverlay: HTMLDivElement | null = null;

    // Canvas for analyzing video frames and page content
    let analysisCanvas: HTMLCanvasElement | null = null;
    let analysisContext: CanvasRenderingContext2D | null = null;

    function initializeDimmer() {
      // Load settings from storage
      browser.storage.sync
        .get([
          "ytDimmerEnabled",
          "ytDimmerDimLevel",
          "ytDimmerBrightnessThreshold",
        ])
        .then((result) => {
          isEnabled = result.ytDimmerEnabled !== false; // Default to true
          dimLevel = result.ytDimmerDimLevel || 0.5;
          brightnessThreshold = result.ytDimmerBrightnessThreshold || 0.6;

          // Always start monitoring so we can remove dimming when disabled
          startMonitoring();
        })
        .catch((err) => {
          // Use defaults on storage error
          isEnabled = true;
          dimLevel = 0.5;
          brightnessThreshold = 0.6;
          // Always start monitoring so we can remove dimming when disabled
          startMonitoring();
        });

      // Listen for settings changes
      browser.storage.onChanged.addListener((changes) => {
        if (changes.ytDimmerEnabled) {
          isEnabled = changes.ytDimmerEnabled.newValue;
          // If disabled, immediately remove any dimming
          if (!isEnabled) {
            removeDimming();
          }
        }
        if (changes.ytDimmerDimLevel) {
          dimLevel = changes.ytDimmerDimLevel.newValue;
        }
        if (changes.ytDimmerBrightnessThreshold) {
          brightnessThreshold = changes.ytDimmerBrightnessThreshold.newValue;
        }
      });
    }

    function createAnalysisCanvas(): void {
      if (!analysisCanvas) {
        analysisCanvas = document.createElement("canvas");
        analysisCanvas.width = 64; // Small size for performance
        analysisCanvas.height = 36;
        // Use willReadFrequently for faster repeated getImageData reads
        analysisContext = analysisCanvas.getContext("2d", {
          willReadFrequently: true,
        });
      }
    }

    function calculatePageBrightness(): number {
      // Get page background color and body styles
      const body = document.body;
      const html = document.documentElement;
      
      // Get computed styles
      const bodyStyle = window.getComputedStyle(body);
      const htmlStyle = window.getComputedStyle(html);
      
      // Check background colors
      const bodyBg = bodyStyle.backgroundColor;
      const htmlBg = htmlStyle.backgroundColor;
      
      // Function to extract RGB values and calculate brightness
      function getBrightnessFromColor(colorString: string): number {
        const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const [, r, g, b] = match.map(Number);
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        }
        return 0;
      }
      
      let pageBrightness = 0;
      
      // Check body background
      if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
        pageBrightness = Math.max(pageBrightness, getBrightnessFromColor(bodyBg));
      }
      
      // Check html background
      if (htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)' && htmlBg !== 'transparent') {
        pageBrightness = Math.max(pageBrightness, getBrightnessFromColor(htmlBg));
      }
      
      // If no background color found, assume white (common default)
      if (pageBrightness === 0) {
        // Check if page looks white by sampling some elements
        const mainContent = document.querySelector('main, [role="main"], .content, .main') || document.body;
        const contentStyle = window.getComputedStyle(mainContent);
        const contentBg = contentStyle.backgroundColor;
        
        if (contentBg && contentBg !== 'rgba(0, 0, 0, 0)' && contentBg !== 'transparent') {
          pageBrightness = getBrightnessFromColor(contentBg);
        } else {
          // Default assumption for pages without explicit background
          pageBrightness = 1.0; // Assume bright/white
        }
      }
      
      return pageBrightness;
    }

    function createPageOverlay(): void {
      if (pageOverlay) return;
      
      pageOverlay = document.createElement('div');
      pageOverlay.id = 'flash-guard-overlay';
      pageOverlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0) !important;
        pointer-events: none !important;
        z-index: 999999 !important;
        transition: background-color 0.3s ease-out !important;
      `;
      
      document.documentElement.appendChild(pageOverlay);
    }

    function updatePageDimming(targetDimLevel: number): void {
      if (!pageOverlay) {
        createPageOverlay();
      }
      
      if (pageOverlay) {
        const opacity = Math.min(0.8, targetDimLevel); // Max 80% dimming
        pageOverlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
      }
      
      currentDimLevel = targetDimLevel;
    }

    function removePageDimming(): void {
      if (pageOverlay) {
        pageOverlay.remove();
        pageOverlay = null;
      }
      currentDimLevel = 0;
    }

    function calculateBrightness(video: HTMLVideoElement): number {
      if (!analysisContext || !analysisCanvas) return 0;

      try {
        // Draw video frame to small canvas for analysis
        analysisContext.drawImage(
          video,
          0,
          0,
          analysisCanvas.width,
          analysisCanvas.height
        );
        const imageData = analysisContext.getImageData(
          0,
          0,
          analysisCanvas.width,
          analysisCanvas.height
        );
        const data = imageData.data;

        let totalBrightness = 0;
        let pixelCount = 0;

        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Calculate luminance using standard formula
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          totalBrightness += brightness;
          pixelCount++;
        }

        return pixelCount > 0 ? totalBrightness / pixelCount : 0;
      } catch (error) {
        // Handle CORS issues or other errors silently
        return lastBrightness;
      }
    }

    function applyDimming(video: HTMLVideoElement): void {
      if (currentVideo !== video) {
        // Remove dimming from previous video
        removeDimming();
        currentVideo = video;
      }
    }

    function updateDimLevel(targetDimLevel: number): void {
      if (!currentVideo) return;

      currentDimLevel = targetDimLevel;

      // Apply brightness filter directly to video with smoother gradual dimming
      const brightness = Math.max(0.1, 1 - currentDimLevel * 0.9); // Allow darker dimming, min 10% brightness
      const filters = `brightness(${brightness})`;

      currentVideo.style.filter = filters;
      // Use longer transition for smoother gradual changes
      currentVideo.style.transition = "filter 0.3s ease-out";
    }

    function removeDimming(): void {
      if (currentVideo) {
        currentVideo.style.filter = "";
        currentVideo.style.transition = "";
      }
      currentVideo = null;
      removePageDimming();
    }

    function monitorContent(): void {
      // First check if extension is enabled
      if (!isEnabled) {
        // If disabled, make sure to remove any existing dimming
        if (currentDimLevel > 0) {
          removeDimming();
        }
        return;
      }

      const videos = document.querySelectorAll(
        "video"
      ) as NodeListOf<HTMLVideoElement>;

      let hasActiveVideo = false;
      let videoBrightness = 0;

      // Check for active videos first (priority over page dimming)
      videos.forEach((video) => {
        if (video.readyState >= 2 && !video.paused && video.currentTime > 0) {
          hasActiveVideo = true;
          // Ensure we're tracking this video
          applyDimming(video);

          const brightness = calculateBrightness(video);

          if (brightness > 0) {
            lastBrightness = brightness;
            videoBrightness = brightness;

            // Calculate gradual dimming based on brightness
            let targetDimLevel = 0;
            
            // Start dimming at a lower threshold for gradual effect
            const gradualStartThreshold = Math.max(0.3, brightnessThreshold - 0.3);
            
            if (brightness > gradualStartThreshold) {
              // Calculate dimming intensity based on how bright the scene is
              const brightnessRange = 1.0 - gradualStartThreshold;
              const brightnessFactor = Math.min(1.0, (brightness - gradualStartThreshold) / brightnessRange);
              
              // Apply gradual dimming that increases with brightness
              if (brightness > brightnessThreshold) {
                // Above user threshold: apply full user-defined dimming (bright/white scenes)
                targetDimLevel = dimLevel;
              } else {
                // Below user threshold but above gradual start: apply much lighter dimming for normal scenes
                // Use brightness level to determine dimming intensity - higher brightness = more dimming
                const normalSceneDimming = brightness > 0.7 ? 0.3 : 0.15; // Very light dimming for non-white backgrounds
                targetDimLevel = dimLevel * brightnessFactor * normalSceneDimming;
              }
            }

            // Smooth transition to target dim level
            const dimDifference = Math.abs(targetDimLevel - currentDimLevel);
            if (dimDifference > 0.05) {
              // Only update if the change is significant enough
              updateDimLevel(targetDimLevel);
            }
          }
        }
      });

      // If no active video, check page brightness
      if (!hasActiveVideo) {
        // Remove video dimming if present
        if (currentVideo) {
          currentVideo.style.filter = "";
          currentVideo.style.transition = "";
          currentVideo = null;
        }

        const pageBrightness = calculatePageBrightness();
        
        if (pageBrightness > 0) {
          lastBrightness = pageBrightness;

          let targetDimLevel = 0;
          
          // Apply dimming if page is bright enough
          if (pageBrightness > brightnessThreshold) {
            // Scale dimming based on page brightness
            const brightnessRange = 1.0 - brightnessThreshold;
            const brightnessFactor = Math.min(1.0, (pageBrightness - brightnessThreshold) / brightnessRange);
            targetDimLevel = dimLevel * brightnessFactor;
          }

          // Smooth transition to target dim level
          const dimDifference = Math.abs(targetDimLevel - currentDimLevel);
          if (dimDifference > 0.05) {
            updatePageDimming(targetDimLevel);
          }
        }
      } else {
        // Remove page overlay if video is active
        removePageDimming();
      }
    }

    function startMonitoring(): void {
      if (monitoringInterval) return;

      createAnalysisCanvas();

      // Monitor at 30 FPS for smooth response - always monitor so we can remove dimming when disabled
      monitoringInterval = window.setInterval(monitorContent, 33);
    }

    function stopMonitoring(): void {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
    }

    // Initialize when page loads
    function init() {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeDimmer);
      } else {
        initializeDimmer();
      }

      // Also try after a short delay to catch dynamically loaded content
      setTimeout(initializeDimmer, 1000);
      setTimeout(initializeDimmer, 3000);
    }

    init();

    // Handle dynamic content loading (SPA navigation)
    const observer = new MutationObserver(() => {
      if (isEnabled && !monitoringInterval) {
        startMonitoring();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      stopMonitoring();
      removeDimming();
      observer.disconnect();
    });
  },
});
