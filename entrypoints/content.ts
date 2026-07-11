import { browser } from "wxt/browser";
import {
  calculateFrameMetrics,
  createDetectorState,
  evaluateFrame,
  type DetectorState,
} from "../lib/detector";
import {
  getEffectiveDimLevel,
  getSettings,
  isSitePaused,
  storageChangesTouchSettings,
  type DimmerSettings,
  type RuntimeStatus,
} from "../lib/settings";

interface VideoState {
  detector: DetectorState;
  originalFilter: string;
  originalTransition: string;
  targetDimLevel: number;
  restoreTimer: number | null;
}

const ANALYSIS_WIDTH = 48;
const ANALYSIS_HEIGHT = 27;
const FALLBACK_FRAME_DELAY = 80;

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let settings: DimmerSettings;
    let activeVideo: HTMLVideoElement | null = null;
    let scheduledFrame: number | null = null;
    let fallbackFrame: number | null = null;
    let lastBrightness = 0;
    let protectionActive = false;
    let protectionCount = 0;
    let countedCurrentActivation = false;
    let refreshQueued = false;
    let destroyed = false;

    const videoStates = new WeakMap<HTMLVideoElement, VideoState>();
    const canvas = document.createElement("canvas");
    canvas.width = ANALYSIS_WIDTH;
    canvas.height = ANALYSIS_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let analysisAvailable = Boolean(context);

    void initialize();

    async function initialize(): Promise<void> {
      settings = await getSettings();
      protectionCount = await getTodayProtectionCount();
      browser.storage.onChanged.addListener(handleStorageChange);
      browser.runtime.onMessage.addListener(handleMessage);
      document.addEventListener("play", refreshActiveVideo, true);
      document.addEventListener("pause", refreshActiveVideo, true);
      document.addEventListener("emptied", refreshActiveVideo, true);
      document.addEventListener("fullscreenchange", refreshActiveVideo);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      refreshActiveVideo();
    }

    const observer = new MutationObserver(() => queueActiveVideoRefresh());

    function queueActiveVideoRefresh(): void {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        refreshActiveVideo();
      });
    }

    const handleStorageChange: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = async (changes, areaName): Promise<void> => {
      if (areaName !== "sync" || !storageChangesTouchSettings(changes)) return;
      settings = await getSettings();
      refreshActiveVideo();
    };

    const handleMessage: Parameters<
      typeof browser.runtime.onMessage.addListener
    >[0] = (message, _sender, sendResponse): true | undefined => {
      if (message.type !== "ytDimmer:getStatus") return undefined;
      sendResponse(getRuntimeStatus());
      return true;
    };

    function getRuntimeStatus(): RuntimeStatus {
      const paused = settings ? isSitePaused(settings, location.hostname) : false;
      const videos = document.querySelectorAll("video");
      return {
        available: analysisAvailable,
        enabled: Boolean(settings?.enabled),
        sitePaused: paused,
        videoDetected: videos.length > 0,
        videoPlaying: Boolean(activeVideo && !activeVideo.paused),
        brightness: lastBrightness,
        protectionActive,
        protectionCount,
        hostname: location.hostname,
      };
    }

    function refreshActiveVideo(): void {
      if (destroyed || !settings) return;
      const shouldRun =
        settings.enabled && !isSitePaused(settings, location.hostname);
      const nextVideo = shouldRun ? findDominantVideo() : null;

      if (nextVideo === activeVideo) {
        if (nextVideo && scheduledFrame === null && fallbackFrame === null) {
          scheduleNextFrame();
        }
        return;
      }

      cancelScheduledFrame();
      if (activeVideo) restoreVideo(activeVideo, true);
      activeVideo = nextVideo;
      protectionActive = false;
      countedCurrentActivation = false;
      if (activeVideo) scheduleNextFrame();
    }

    function findDominantVideo(): HTMLVideoElement | null {
      const videos = Array.from(
        document.querySelectorAll<HTMLVideoElement>("video"),
      );
      let winner: HTMLVideoElement | null = null;
      let winnerScore = 0;

      for (const video of videos) {
        if (video.paused || video.ended || video.readyState < 2) continue;
        const rect = video.getBoundingClientRect();
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
        );
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
        );
        const score = visibleWidth * visibleHeight;
        if (score > winnerScore) {
          winner = video;
          winnerScore = score;
        }
      }
      return winner;
    }

    function scheduleNextFrame(): void {
      if (!activeVideo || destroyed) return;
      if (activeVideo.requestVideoFrameCallback) {
        scheduledFrame = activeVideo.requestVideoFrameCallback(processFrame);
      } else {
        fallbackFrame = window.setTimeout(processFrame, FALLBACK_FRAME_DELAY);
      }
    }

    function processFrame(): void {
      scheduledFrame = null;
      fallbackFrame = null;
      const video = activeVideo;
      if (!video || video.paused || video.ended || !context) {
        refreshActiveVideo();
        return;
      }

      try {
        context.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
        const pixels = context.getImageData(
          0,
          0,
          ANALYSIS_WIDTH,
          ANALYSIS_HEIGHT,
        ).data;
        const metrics = calculateFrameMetrics(pixels, 2);
        analysisAvailable = true;
        const state = getVideoState(video);
        const detection = evaluateFrame(state.detector, metrics, {
          brightnessThreshold: settings.brightnessThreshold,
          dimLevel: getEffectiveDimLevel(settings),
        });

        lastBrightness = detection.brightness;
        applyDimLevel(video, state, detection.targetDimLevel);
        protectionActive = detection.protectionActive;

        if (detection.flashDetected && !countedCurrentActivation) {
          countedCurrentActivation = true;
          protectionCount += 1;
          void saveTodayProtectionCount(protectionCount);
        } else if (!detection.protectionActive) {
          countedCurrentActivation = false;
        }
      } catch {
        // Some cross-origin video sources prevent canvas reads. Keep playback
        // untouched and retry later in case the media source changes.
        protectionActive = false;
        analysisAvailable = false;
        restoreVideo(video);
      }

      scheduleNextFrame();
    }

    function getVideoState(video: HTMLVideoElement): VideoState {
      let state = videoStates.get(video);
      if (!state) {
        state = {
          detector: createDetectorState(),
          originalFilter: video.style.filter,
          originalTransition: video.style.transition,
          targetDimLevel: 0,
          restoreTimer: null,
        };
        videoStates.set(video, state);
      }
      return state;
    }

    function applyDimLevel(
      video: HTMLVideoElement,
      state: VideoState,
      target: number,
    ): void {
      if (Math.abs(target - state.targetDimLevel) < 0.025) return;
      const isAttack = target > state.targetDimLevel;
      state.targetDimLevel = target;
      if (state.restoreTimer) window.clearTimeout(state.restoreTimer);

      const brightness = Math.max(0.16, 1 - target * 0.88);
      const dimFilter = target > 0 ? `brightness(${brightness.toFixed(3)})` : "";
      video.style.filter = [dimFilter, state.originalFilter].filter(Boolean).join(" ");
      video.style.transition = `filter ${isAttack ? 40 : 620}ms ${
        isAttack ? "linear" : "cubic-bezier(.2,.8,.2,1)"
      }`;

      if (target === 0) {
        state.restoreTimer = window.setTimeout(() => {
          video.style.filter = state.originalFilter;
          video.style.transition = state.originalTransition;
          state.restoreTimer = null;
        }, 650);
      }
    }

    function restoreVideo(video: HTMLVideoElement, immediately = false): void {
      const state = videoStates.get(video);
      if (!state) return;
      if (state.restoreTimer) window.clearTimeout(state.restoreTimer);
      if (immediately) {
        video.style.filter = state.originalFilter;
        video.style.transition = state.originalTransition;
        state.targetDimLevel = 0;
      } else {
        applyDimLevel(video, state, 0);
      }
    }

    function cancelScheduledFrame(): void {
      if (
        activeVideo?.cancelVideoFrameCallback &&
        scheduledFrame !== null
      ) {
        activeVideo.cancelVideoFrameCallback(scheduledFrame);
      }
      if (fallbackFrame !== null) window.clearTimeout(fallbackFrame);
      scheduledFrame = null;
      fallbackFrame = null;
    }

    async function getTodayProtectionCount(): Promise<number> {
      const key = dailyCountKey();
      const stored = await browser.storage.local.get(key);
      return stored[key] ?? 0;
    }

    async function saveTodayProtectionCount(count: number): Promise<void> {
      await browser.storage.local.set({ [dailyCountKey()]: count });
    }

    function dailyCountKey(): string {
      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      return `ytDimmerProtectionCount:${date}`;
    }

    window.addEventListener(
      "pagehide",
      () => {
        destroyed = true;
        cancelScheduledFrame();
        if (activeVideo) restoreVideo(activeVideo, true);
        observer.disconnect();
        browser.storage.onChanged.removeListener(handleStorageChange);
        browser.runtime.onMessage.removeListener(handleMessage);
      },
      { once: true },
    );
  },
});
