# YT Dimmer detection engine

## Goal

Version 2 distinguishes two related conditions:

1. **Sudden flashes** — abrupt temporal changes that should trigger a fast,
   strong response.
2. **Sustained bright scenes** — stable scenes that receive lighter comfort
   dimming without being reported as repeated flashes.

The algorithm is deterministic, runs locally, and is implemented as a pure
state machine in `lib/detector.ts`.

## Frame sampling

The content script selects the largest visible, currently playing video. It
uses `requestVideoFrameCallback` when available and an 80 ms fallback otherwise.
Each frame is scaled to a 48 × 27 analysis canvas and every second pixel is
sampled.

For each sampled frame, the detector calculates:

- Mean Rec. 709 luminance: `0.2126R + 0.7152G + 0.0722B`
- Peak sampled luminance
- Ratio of pixels whose luminance is at least `0.82`

## Temporal evaluation

The detector keeps the previous frame and a slowly adapting brightness
baseline. A flash score is the maximum of:

- frame-to-frame mean luminance increase;
- increase above the adaptive baseline;
- change in bright-pixel coverage; and
- peak-luminance increase.

The user's trigger setting changes the required jump. A candidate flash must
also contain a sufficiently bright mean, peak, or region so ordinary dark-scene
noise does not trigger protection.

Bright frames update the baseline slowly. Darker frames update it more quickly.
This prevents one bright frame from immediately becoming the new normal.

## Response curve

- A detected flash immediately requests the configured protection strength.
- Sustained bright scenes use a proportional response capped below full flash
  strength.
- A ten-frame hold supplies hysteresis after a flash.
- Filter attack uses a 40 ms linear transition.
- Recovery uses a 620 ms eased transition.
- The resulting video brightness never drops below 16%.

Existing inline `filter` and `transition` styles are preserved and restored.
Only the dominant playing video is modified, while a `WeakMap` keeps isolated
state for every player encountered on the page.

## Scheduling and performance

No permanent 30 FPS page interval is used. Analysis follows actual decoded
video frames, stops when no eligible video is playing, and is disabled for
paused sites or when global protection is off. DOM mutation refreshes are
coalesced to one animation frame.

No fixed CPU percentage is claimed because cost varies by browser, hardware,
resolution, codec, and page structure. Release profiling should include several
real streaming sites before publishing performance numbers.

## Failure behavior

Canvas reads can fail for protected cross-origin media. On failure, YT Dimmer:

- does not change the video's appearance;
- reports analysis as unavailable to the popup; and
- retries on later frames in case the media source changes.

## Test coverage

`lib/detector.test.ts` covers:

- luminance and bright-region calculation;
- sudden full-frame flashes;
- small bright regions;
- stable bright scenes;
- gradual fades;
- rapid dark-to-bright cuts; and
- hold and recovery behavior.

Run the suite with `pnpm test`.
