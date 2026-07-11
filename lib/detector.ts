export interface FrameMetrics {
  mean: number;
  peak: number;
  brightRatio: number;
}

export interface DetectorConfig {
  brightnessThreshold: number;
  dimLevel: number;
}

export interface DetectionResult {
  targetDimLevel: number;
  protectionActive: boolean;
  flashDetected: boolean;
  brightness: number;
}

export interface DetectorState {
  previousMean: number;
  previousPeak: number;
  previousBrightRatio: number;
  baseline: number;
  releaseFrames: number;
  targetDimLevel: number;
  initialized: boolean;
}

export function createDetectorState(): DetectorState {
  return {
    previousMean: 0,
    previousPeak: 0,
    previousBrightRatio: 0,
    baseline: 0,
    releaseFrames: 0,
    targetDimLevel: 0,
    initialized: false,
  };
}

export function calculateFrameMetrics(
  pixels: Uint8ClampedArray,
  sampleStride = 4,
): FrameMetrics {
  let sum = 0;
  let peak = 0;
  let brightPixels = 0;
  let count = 0;
  const byteStride = Math.max(1, sampleStride) * 4;

  for (let index = 0; index < pixels.length; index += byteStride) {
    // Rec. 709 luminance matches modern display/video primaries.
    const luminance =
      (0.2126 * pixels[index] +
        0.7152 * pixels[index + 1] +
        0.0722 * pixels[index + 2]) /
      255;
    sum += luminance;
    peak = Math.max(peak, luminance);
    if (luminance >= 0.82) brightPixels += 1;
    count += 1;
  }

  if (count === 0) return { mean: 0, peak: 0, brightRatio: 0 };
  return {
    mean: sum / count,
    peak,
    brightRatio: brightPixels / count,
  };
}

export function evaluateFrame(
  state: DetectorState,
  metrics: FrameMetrics,
  config: DetectorConfig,
): DetectionResult {
  if (!state.initialized) {
    state.previousMean = metrics.mean;
    state.previousPeak = metrics.peak;
    state.previousBrightRatio = metrics.brightRatio;
    state.baseline = metrics.mean;
    state.initialized = true;
    return result(0, false, metrics.mean);
  }

  const meanJump = metrics.mean - state.previousMean;
  const brightAreaJump = metrics.brightRatio - state.previousBrightRatio;
  const peakJump = metrics.peak - state.previousPeak;
  const sensitivity = 1 - config.brightnessThreshold;
  const jumpThreshold = 0.2 - sensitivity * 0.16;

  const flashScore = Math.max(
    meanJump * 1.5,
    brightAreaJump * 0.9,
    peakJump * 0.45,
  );
  const hasBrightRegion =
    metrics.mean >= config.brightnessThreshold * 0.72 ||
    metrics.brightRatio >= 0.08 ||
    metrics.peak >= 0.94;
  const flashDetected = flashScore >= jumpThreshold && hasBrightRegion;

  // Comfort dimming handles sustained bright scenes without labelling them flashes.
  const comfortStart = Math.max(0.32, config.brightnessThreshold - 0.14);
  const comfortProgress = clamp(
    (metrics.mean - comfortStart) / (1 - comfortStart),
    0,
    1,
  );
  const comfortDim = config.dimLevel * comfortProgress * 0.62;

  if (flashDetected) {
    state.releaseFrames = 10;
    state.targetDimLevel = Math.max(config.dimLevel, comfortDim);
  } else if (state.releaseFrames > 0) {
    state.releaseFrames -= 1;
    state.targetDimLevel = Math.max(
      comfortDim,
      state.targetDimLevel * (state.releaseFrames / (state.releaseFrames + 1)),
    );
  } else {
    state.targetDimLevel = comfortDim;
  }

  // Darker frames adapt quickly; bright frames update the baseline slowly so a
  // flash cannot immediately redefine "normal".
  const baselineRate = metrics.mean < state.baseline ? 0.18 : 0.025;
  state.baseline += (metrics.mean - state.baseline) * baselineRate;
  state.previousMean = metrics.mean;
  state.previousPeak = metrics.peak;
  state.previousBrightRatio = metrics.brightRatio;

  const target = state.targetDimLevel < 0.025 ? 0 : state.targetDimLevel;
  return result(target, flashDetected, metrics.mean);
}

function result(
  targetDimLevel: number,
  flashDetected: boolean,
  brightness: number,
): DetectionResult {
  return {
    targetDimLevel,
    protectionActive: targetDimLevel > 0.025,
    flashDetected,
    brightness,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
