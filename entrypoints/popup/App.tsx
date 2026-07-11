import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import Icon from "@/assets/icon.png";
import {
  DEFAULT_SETTINGS,
  PRESETS,
  getSettings,
  isScheduleActive,
  saveSettings,
  type DimmerSettings,
  type ProtectionPreset,
  type RuntimeStatus,
} from "../../lib/settings";
import "./App.css";

const EMPTY_STATUS: RuntimeStatus = {
  available: false,
  enabled: true,
  sitePaused: false,
  videoDetected: false,
  videoPlaying: false,
  brightness: 0,
  protectionActive: false,
  protectionCount: 0,
  hostname: "",
};

const PRESET_COPY: Record<
  Exclude<ProtectionPreset, "custom">,
  { label: string; description: string }
> = {
  gentle: { label: "Gentle", description: "Soft correction" },
  balanced: { label: "Balanced", description: "Everyday comfort" },
  maximum: { label: "Maximum", description: "Most responsive" },
};

function App() {
  const [settings, setSettings] = useState<DimmerSettings | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>(EMPTY_STATUS);
  const activeTabId = useRef<number | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const importInput = useRef<HTMLInputElement>(null);

  const readStatus = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      activeTabId.current = tab.id;
      const response = (await browser.tabs.sendMessage(tab.id, {
        type: "ytDimmer:getStatus",
      })) as RuntimeStatus;
      setStatus(response);
    } catch {
      setStatus((current) => ({ ...current, available: false }));
    }
  }, []);

  useEffect(() => {
    void Promise.all([getSettings(), readStatus()]).then(([loadedSettings]) => {
      setSettings(loadedSettings);
    });
    const interval = window.setInterval(readStatus, 700);
    return () => window.clearInterval(interval);
  }, [readStatus]);

  const updateSettings = useCallback(
    async (patch: Partial<DimmerSettings>) => {
      setSettings((current) => (current ? { ...current, ...patch } : current));
      setSaveState("idle");
      try {
        await saveSettings(patch);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1200);
        if (activeTabId.current) void readStatus();
      } catch {
        setSaveState("error");
      }
    },
    [readStatus],
  );

  if (!settings) {
    return (
      <main className="popup-shell loading-shell" aria-live="polite">
        <div className="loading-mark">
          <img src={Icon} alt="" />
        </div>
        <p>Preparing your night shield…</p>
      </main>
    );
  }

  const effectiveEnabled = settings.enabled && !status.sitePaused;
  const meterValue = Math.round(status.brightness * 100);
  const statusText = getStatusText(settings, status);
  const siteName = status.hostname || "This page";

  const applyPreset = (preset: Exclude<ProtectionPreset, "custom">) => {
    void updateSettings({ preset, ...PRESETS[preset] });
  };

  const toggleCurrentSite = () => {
    if (!status.hostname) return;
    const nextRules = { ...settings.siteRules };
    if (status.sitePaused) delete nextRules[status.hostname];
    else nextRules[status.hostname] = "paused";
    void updateSettings({ siteRules: nextRules });
  };

  const exportSettings = () => {
    const file = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "yt-dimmer-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DimmerSettings>;
      const clean = sanitizeImportedSettings(parsed);
      await updateSettings(clean);
    } catch {
      setSaveState("error");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  return (
    <main className="popup-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={Icon} alt="" className="brand-icon" />
          <div>
            <p className="eyebrow">Night viewing utility</p>
            <h1>YT Dimmer</h1>
          </div>
        </div>
        <span className={`save-state ${saveState}`} aria-live="polite">
          {saveState === "saved" ? "Saved" : saveState === "error" ? "Retry" : "v2.0"}
        </span>
      </header>

      <section className={`protection-hero ${effectiveEnabled ? "is-on" : "is-off"}`}>
        <div className="orb-wrap" aria-hidden="true">
          <div className="orbit" />
          <div className="moon-orb">
            <span className="moon-cutout" />
          </div>
        </div>
        <div className="hero-copy">
          <span className="status-kicker">
            <i className={status.protectionActive ? "pulse" : ""} />
            {status.protectionActive ? "Softening now" : "Protection status"}
          </span>
          <h2>{statusText}</h2>
          <p>{getStatusDescription(settings, status)}</p>
        </div>
        <button
          type="button"
          className="power-button"
          aria-pressed={settings.enabled}
          aria-label={settings.enabled ? "Disable protection" : "Enable protection"}
          onClick={() => void updateSettings({ enabled: !settings.enabled })}
        >
          <PowerIcon />
        </button>
      </section>

      <section className="site-panel" aria-label="Current site">
        <div className="site-heading">
          <div className={`site-signal ${effectiveEnabled ? "active" : ""}`}>
            <span />
          </div>
          <div className="site-copy">
            <span>Current site</span>
            <strong title={siteName}>{siteName}</strong>
          </div>
          {status.hostname ? (
            <button type="button" className="quiet-button" onClick={toggleCurrentSite}>
              {status.sitePaused ? "Resume" : "Pause here"}
            </button>
          ) : null}
        </div>
        <div className="meter-row">
          <span>Scene luminance</span>
          <div className="luminance-track" aria-label={`Scene luminance ${meterValue}%`}>
            <span style={{ width: `${meterValue}%` }} />
            <i className="threshold-marker" style={{ left: `${settings.brightnessThreshold * 100}%` }} />
          </div>
          <output>{status.videoPlaying ? `${meterValue}%` : "—"}</output>
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <div>
            <p className="eyebrow">Protection profile</p>
            <h3>Choose your comfort level</h3>
          </div>
          {settings.preset === "custom" ? <span className="custom-pill">Custom</span> : null}
        </div>
        <div className="preset-grid">
          {(Object.keys(PRESET_COPY) as Array<Exclude<ProtectionPreset, "custom">>).map(
            (preset) => (
              <button
                type="button"
                key={preset}
                className={`preset-card ${settings.preset === preset ? "selected" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                <span className="preset-glyph" aria-hidden="true">
                  {preset === "gentle" ? "◔" : preset === "balanced" ? "◑" : "●"}
                </span>
                <strong>{PRESET_COPY[preset].label}</strong>
                <small>{PRESET_COPY[preset].description}</small>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="activity-strip">
        <div>
          <span className="activity-number">{status.protectionCount}</span>
          <span>bright {status.protectionCount === 1 ? "moment" : "moments"} softened today</span>
        </div>
        <button type="button" className="calibrate-button" onClick={() => setCalibrating((value) => !value)}>
          <TuneIcon /> Calibrate
        </button>
      </section>

      {calibrating ? (
        <section className="calibration-panel" aria-live="polite">
          <div className="calibration-preview" aria-hidden="true">
            <span />
          </div>
          <div className="calibration-copy">
            <strong>Comfort check</strong>
            <p>Watch the soft pulse, then choose the response that feels right.</p>
          </div>
          <div className="calibration-actions">
            <button type="button" onClick={() => applyPreset("gentle")}>Too dark</button>
            <button type="button" onClick={() => applyPreset("balanced")}>Comfortable</button>
            <button type="button" onClick={() => applyPreset("maximum")}>Stronger</button>
          </div>
        </section>
      ) : null}

      <AdvancedControls
        settings={settings}
        updateSettings={updateSettings}
        exportSettings={exportSettings}
        importSettings={importSettings}
        importInput={importInput}
      />

      <footer>
        <span><LockIcon /> Processed privately on your device</span>
        <a href="https://github.com/C-W-D-Harshit/ytdimmer" target="_blank" rel="noreferrer">Source</a>
      </footer>
    </main>
  );
}

interface AdvancedControlsProps {
  settings: DimmerSettings;
  updateSettings: (patch: Partial<DimmerSettings>) => Promise<void>;
  exportSettings: () => void;
  importSettings: (file?: File) => Promise<void>;
  importInput: React.RefObject<HTMLInputElement | null>;
}

function AdvancedControls({
  settings,
  updateSettings,
  exportSettings,
  importSettings,
  importInput,
}: AdvancedControlsProps) {
  return (
    <details className="advanced-panel">
      <summary>
        <span><SlidersIcon /> Advanced controls</span>
        <ChevronIcon />
      </summary>
      <div className="advanced-content">
        <RangeControl
          label="Trigger sensitivity"
          value={settings.brightnessThreshold}
          min={0.35}
          max={0.85}
          step={0.01}
          startLabel="More sensitive"
          endLabel="Very bright only"
          onChange={(brightnessThreshold) =>
            void updateSettings({ brightnessThreshold, preset: "custom" })
          }
        />
        <RangeControl
          label="Dimming strength"
          value={settings.dimLevel}
          min={0.2}
          max={0.9}
          step={0.01}
          startLabel="Subtle"
          endLabel="Deep"
          onChange={(dimLevel) =>
            void updateSettings({ dimLevel, preset: "custom" })
          }
        />

        <div className="schedule-row">
          <div>
            <strong>Night boost</strong>
            <span>
              {isScheduleActive(settings)
                ? "Active now"
                : "Adds extra protection on schedule"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Toggle scheduled night boost"
            aria-checked={settings.scheduleEnabled}
            className={`switch ${settings.scheduleEnabled ? "checked" : ""}`}
            onClick={() =>
              void updateSettings({ scheduleEnabled: !settings.scheduleEnabled })
            }
          >
            <span />
          </button>
        </div>
        {settings.scheduleEnabled ? (
          <div className="time-grid">
            <TimeSelect
              label="Starts"
              value={settings.scheduleStart}
              onChange={(scheduleStart) => void updateSettings({ scheduleStart })}
            />
            <TimeSelect
              label="Ends"
              value={settings.scheduleEnd}
              onChange={(scheduleEnd) => void updateSettings({ scheduleEnd })}
            />
          </div>
        ) : null}

        <div className="data-actions">
          <button type="button" onClick={exportSettings}>Export</button>
          <button type="button" onClick={() => importInput.current?.click()}>Import</button>
          <button type="button" onClick={() => void updateSettings(DEFAULT_SETTINGS)}>Reset</button>
          <input
            ref={importInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => void importSettings(event.target.files?.[0])}
          />
        </div>
        <p className="shortcut-note">
          Quick toggle: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
        </p>
      </div>
    </details>
  );
}

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  startLabel: string;
  endLabel: string;
  onChange: (value: number) => void;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  startLabel,
  endLabel,
  onChange,
}: RangeControlProps) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="range-control">
      <span><strong>{label}</strong><output>{Math.round(value * 100)}%</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small><span>{startLabel}</span><span>{endLabel}</span></small>
    </label>
  );
}

function TimeSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="time-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {Array.from({ length: 24 }, (_, hour) => (
          <option value={hour} key={hour}>{formatHour(hour)}</option>
        ))}
      </select>
    </label>
  );
}

function getStatusText(settings: DimmerSettings, status: RuntimeStatus): string {
  if (!settings.enabled) return "Protection is off";
  if (status.sitePaused) return "Paused on this site";
  if (!status.available) return "Ready when video plays";
  if (!status.videoDetected) return "Waiting for a video";
  if (!status.videoPlaying) return "Video is paused";
  if (status.protectionActive) return "Bright scene softened";
  return "Watching quietly";
}

function getStatusDescription(settings: DimmerSettings, status: RuntimeStatus): string {
  if (!settings.enabled) return "Turn it on whenever your eyes need a softer screen.";
  if (status.sitePaused) return "Other sites remain protected.";
  if (!status.videoPlaying) return "Detection begins automatically with playback.";
  return "Frame analysis stays local and never records your video.";
}

function sanitizeImportedSettings(input: Partial<DimmerSettings>): Partial<DimmerSettings> {
  const clean: Partial<DimmerSettings> = {};
  if (typeof input.enabled === "boolean") clean.enabled = input.enabled;
  if (typeof input.dimLevel === "number") clean.dimLevel = Math.min(0.9, Math.max(0.2, input.dimLevel));
  if (typeof input.brightnessThreshold === "number") clean.brightnessThreshold = Math.min(0.85, Math.max(0.35, input.brightnessThreshold));
  if (["gentle", "balanced", "maximum", "custom"].includes(input.preset ?? "")) clean.preset = input.preset;
  if (typeof input.scheduleEnabled === "boolean") clean.scheduleEnabled = input.scheduleEnabled;
  if (typeof input.scheduleStart === "number") clean.scheduleStart = Math.min(23, Math.max(0, Math.round(input.scheduleStart)));
  if (typeof input.scheduleEnd === "number") clean.scheduleEnd = Math.min(23, Math.max(0, Math.round(input.scheduleEnd)));
  if (input.siteRules && typeof input.siteRules === "object") {
    clean.siteRules = Object.fromEntries(
      Object.entries(input.siteRules).filter(
        ([hostname, mode]) => hostname.length > 0 && mode === "paused",
      ),
    );
  }
  return clean;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return `${hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

function PowerIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M7.05 5.64a8 8 0 1 0 9.9 0" /></svg>; }
function TuneIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6" /></svg>; }
function SlidersIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4M12 7h8M4 17h8M16 17h4M8 4v6M16 14v6" /></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>; }

export default App;
