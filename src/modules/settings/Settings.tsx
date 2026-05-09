import { useState, type ReactNode } from "react";
import { Btn } from "@/components/Btn";
import { Kbd } from "@/components/Kbd";
import { useLayout, type Side } from "@/lib/layout";
import { useSettings, patchSettings } from "@/lib/settings";

const CATEGORIES = [
  "General",
  "Appearance",
  "Terminal",
  "Keymap",
  "AI · valley",
  "Privacy",
  "Updates",
  "About",
] as const;

export function Settings() {
  const [active, setActive] = useState<string>("Appearance");
  const settings = useSettings();
  const layout = useLayout();

  return (
    <div className="vy-settings">
      <div className="cats">
        <div className="cats-head">SETTINGS</div>
        {CATEGORIES.map((c) => (
          <div
            key={c}
            className={`cats-row${active === c ? " is-active" : ""}`}
            onClick={() => setActive(c)}
          >
            {c}
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>{active}</h2>
          <div className="hint">⌘, to reopen · changes save instantly</div>
        </div>

        <Section label="LAYOUT">
          <Row
            title="Sidebar position"
            sub="file explorer · default right"
          >
            <SideSeg
              value={layout.sidebar}
              onChange={layout.setSidebar}
            />
          </Row>
          <Row
            title="AI panel position"
            sub="valley chat · default left"
          >
            <SideSeg value={layout.ai} onChange={layout.setAi} />
          </Row>
        </Section>

        <Section label="THEME">
          <Row title="Color theme" sub="Gruvbox is the only canonical palette.">
            <div className="seg">
              <span
                className={`seg-i${settings.theme === "dark" ? " on" : ""}`}
                onClick={() => void patchSettings({ theme: "dark" })}
              >
                dark
              </span>
              <span
                className={`seg-i${settings.theme === "light" ? " on" : ""}`}
                onClick={() => void patchSettings({ theme: "light" })}
              >
                light hard
              </span>
              <span
                className={`seg-i${settings.theme === "auto" ? " on" : ""}`}
                onClick={() => void patchSettings({ theme: "auto" })}
              >
                follow system
              </span>
            </div>
          </Row>
          <Row
            title="Window vibrancy"
            sub="macOS background blur · adds warmth, costs a little perf"
          >
            <Switch
              on={settings.vibrancy}
              onChange={() => void patchSettings({ vibrancy: !settings.vibrancy })}
            />
          </Row>
          <Row title="Font ligatures" sub="Geist Mono → ‒› ≠ ⇒ etc.">
            <Switch
              on={settings.ligatures}
              onChange={() => void patchSettings({ ligatures: !settings.ligatures })}
            />
          </Row>
          <Row title="Cursor" sub="Block · classic terminal">
            <select className="select" defaultValue="block">
              <option value="block">block</option>
              <option value="underscore">underscore</option>
              <option value="bar">bar</option>
            </select>
          </Row>
        </Section>

        <Section label="AI · valley">
          <Row
            title="Auto-approve read tools"
            sub="file_read, list_dir, grep — no approval prompt"
          >
            <Switch
              on={settings.autoApproveReadTools}
              onChange={() => void patchSettings({ autoApproveReadTools: !settings.autoApproveReadTools })}
            />
          </Row>
          <Row
            title="Inline ghost suggestions"
            sub="dimmed continuation as you type · ⇥ to accept"
          >
            <Switch on />
          </Row>
          <Row title="Ask valley shortcut">
            <span className="kbd-pair">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </Row>
          <Row title="Model" sub="haiku is the default fast model">
            <select className="select" defaultValue="haiku-4.5">
              <option>haiku-4.5</option>
              <option>sonnet-4.6</option>
              <option>opus-4.7</option>
            </select>
          </Row>
        </Section>

        <Section label="DATA">
          <Row title="Telemetry" sub="anonymous error reports only">
            <Switch on={false} />
          </Row>
          <Row title="Reset all settings" sub="this cannot be undone">
            <Btn variant="destructive">Reset…</Btn>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="set-section">
      <div className="set-section-h">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SideSeg({
  value,
  onChange,
}: {
  value: Side;
  onChange: (s: Side) => void;
}) {
  return (
    <div className="seg">
      <span
        className={`seg-i${value === "left" ? " on" : ""}`}
        onClick={() => onChange("left")}
      >
        left
      </span>
      <span
        className={`seg-i${value === "right" ? " on" : ""}`}
        onClick={() => onChange("right")}
      >
        right
      </span>
    </div>
  );
}

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange?: () => void;
}) {
  return (
    <div
      className={`switch${on ? " is-on" : ""}`}
      onClick={onChange}
      role="switch"
      aria-checked={on}
    >
      <div className="knob" />
    </div>
  );
}
