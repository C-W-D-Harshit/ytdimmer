import { describe, expect, it } from "vitest";
import {
  calculateFrameMetrics,
  createDetectorState,
  evaluateFrame,
  type FrameMetrics,
} from "./detector";

const config = { brightnessThreshold: 0.62, dimLevel: 0.55 };
const frame = (mean: number, peak = mean, brightRatio = 0): FrameMetrics => ({
  mean,
  peak,
  brightRatio,
});

describe("calculateFrameMetrics", () => {
  it("calculates luminance and bright-pixel coverage", () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]);
    const metrics = calculateFrameMetrics(pixels, 1);
    expect(metrics.mean).toBeCloseTo(0.5, 2);
    expect(metrics.peak).toBeCloseTo(1, 2);
    expect(metrics.brightRatio).toBe(0.5);
  });
});

describe("evaluateFrame", () => {
  it("reacts strongly to a sudden white flash", () => {
    const state = createDetectorState();
    evaluateFrame(state, frame(0.18, 0.3), config);
    const result = evaluateFrame(state, frame(0.88, 1, 0.82), config);
    expect(result.flashDetected).toBe(true);
    expect(result.targetDimLevel).toBeGreaterThanOrEqual(config.dimLevel);
  });

  it("does not label a stable bright scene as a repeated flash", () => {
    const state = createDetectorState();
    evaluateFrame(state, frame(0.76, 0.9, 0.3), config);
    const result = evaluateFrame(state, frame(0.77, 0.9, 0.3), config);
    expect(result.flashDetected).toBe(false);
    expect(result.targetDimLevel).toBeGreaterThan(0);
    expect(result.targetDimLevel).toBeLessThan(config.dimLevel);
  });

  it("detects a small but abrupt bright region", () => {
    const state = createDetectorState();
    evaluateFrame(state, frame(0.2, 0.38, 0), config);
    const result = evaluateFrame(state, frame(0.28, 1, 0.14), config);
    expect(result.flashDetected).toBe(true);
  });

  it("holds protection briefly and then recovers", () => {
    const state = createDetectorState();
    evaluateFrame(state, frame(0.15), config);
    evaluateFrame(state, frame(0.92, 1, 0.9), config);
    const held = evaluateFrame(state, frame(0.18), config);
    expect(held.targetDimLevel).toBeGreaterThan(0);
    let recovered = held;
    for (let index = 0; index < 14; index += 1) {
      recovered = evaluateFrame(state, frame(0.18), config);
    }
    expect(recovered.targetDimLevel).toBe(0);
  });

  it("treats a gradual fade as comfort dimming rather than a flash", () => {
    const state = createDetectorState();
    let result = evaluateFrame(state, frame(0.18), config);
    for (const brightness of [0.25, 0.32, 0.39, 0.46, 0.53, 0.6, 0.67]) {
      result = evaluateFrame(state, frame(brightness, brightness + 0.08, 0.03), config);
      expect(result.flashDetected).toBe(false);
    }
    expect(result.targetDimLevel).toBeGreaterThan(0);
    expect(result.targetDimLevel).toBeLessThan(config.dimLevel);
  });

  it("detects a rapid cut from a dark scene to a bright scene", () => {
    const state = createDetectorState();
    evaluateFrame(state, frame(0.12, 0.24), config);
    evaluateFrame(state, frame(0.16, 0.3), config);
    const cut = evaluateFrame(state, frame(0.7, 0.98, 0.36), config);
    expect(cut.flashDetected).toBe(true);
  });
});
