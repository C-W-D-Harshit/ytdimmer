# Contributing

Thanks for helping improve YT Dimmer.

## Development workflow

1. Install dependencies with `pnpm install`.
2. Create a focused branch.
3. Add or update tests for detector behavior.
4. Run `pnpm compile`, `pnpm test`, and `pnpm build`.
5. Manually verify the unpacked extension on at least one HTML video site.

Detector changes should include synthetic sequences showing the expected
behavior. UI changes should be checked at the 380 × 600 popup viewport, with
keyboard focus visible and reduced-motion preferences respected.

Please avoid claims that the extension prevents seizures, provides medical
protection, works on every video source, or meets a fixed performance target
unless those claims are backed by appropriate independent evidence.
