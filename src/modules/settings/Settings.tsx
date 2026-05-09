import { useState, type ReactNode } from "react";
import { Btn } from "@/components/Btn";
import { Kbd } from "@/components/Kbd";
import { useLayout, type Side } from "@/lib/layout";
import { useSettings, patchSettings } from "@/lib/settings";
import {
  SHORTCUTS,
  GROUP_LABELS,
  comboGlyphs,
  type ShortcutGroup,
} from "@/modules/shortcuts/shortcuts";

const CATEGORIES = [
  "Appearance",
  "Keymap",
  "AI · valley",
  "Privacy",
  "About",
] as const;

type Category = (typeof CATEGORIES)[number];

export function Settings() {
  const [active, setActive] = useState<Category>("Appearance");

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

        {active === "Appearance" && <AppearancePanel />}
        {active === "Keymap" && <KeymapPanel />}
        {active === "AI · valley" && <AiPanel />}
        {active === "Privacy" && <PrivacyPanel />}
        {active === "About" && <AboutPanel />}
      </div>
    </div>
  );
}

/* ─── panels ─── */

function AppearancePanel() {
  const settings = useSettings();
  const layout = useLayout();
  return (
    <>
      <Section label="LAYOUT">
        <Row title="Sidebar position" sub="file explorer · default right">
          <SideSeg value={layout.sidebar} onChange={layout.setSidebar} />
        </Row>
        <Row title="AI panel position" sub="valley chat · default left">
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
            onChange={() =>
              void patchSettings({ ligatures: !settings.ligatures })
            }
          />
        </Row>
      </Section>
    </>
  );
}

function KeymapPanel() {
  const groups: ShortcutGroup[] = ["general", "tabs", "view", "ai"];
  return (
    <>
      <p className="set-blurb">
        Quick reference for valley controls. All shortcuts work anywhere in the
        app.
      </p>
      {groups.map((g) => {
        const items = SHORTCUTS.filter((s) => s.group === g);
        if (items.length === 0) return null;
        return (
          <Section key={g} label={GROUP_LABELS[g]}>
            {items.map((s) => (
              <div key={s.id} className="set-row">
                <div className="set-row-text">
                  <div className="t">{s.label}</div>
                </div>
                <div className="kbd-pair">
                  {comboGlyphs(s.combo).map((g, i) => (
                    <Kbd key={i}>{g}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        );
      })}
    </>
  );
}

function AiPanel() {
  const settings = useSettings();
  return (
    <Section label="AI · valley">
      <Row
        title="Auto-approve read tools"
        sub="file_read, list_dir, grep — no approval prompt"
      >
        <Switch
          on={settings.autoApproveReadTools}
          onChange={() =>
            void patchSettings({
              autoApproveReadTools: !settings.autoApproveReadTools,
            })
          }
        />
      </Row>
      <Row
        title="Inline ghost suggestions"
        sub="dimmed continuation as you type · ⇥ to accept · phase 2"
      >
        <Switch on={false} />
      </Row>
      <Row title="Default provider" sub="anthropic · openai">
        <select
          className="select"
          value={settings.defaultProvider}
          onChange={(e) =>
            void patchSettings({
              defaultProvider: e.target.value as "openai" | "anthropic",
            })
          }
        >
          <option value="anthropic">anthropic</option>
          <option value="openai">openai</option>
        </select>
      </Row>
      <Row title="Default model" sub="haiku is the default fast model">
        <input
          className="input"
          style={{ width: 240 }}
          value={settings.defaultModel}
          onChange={(e) => void patchSettings({ defaultModel: e.target.value })}
        />
      </Row>
    </Section>
  );
}

function PrivacyPanel() {
  return (
    <Section label="DATA">
      <Row title="Telemetry" sub="anonymous error reports only · always off">
        <Switch on={false} />
      </Row>
      <Row title="Reset all settings" sub="this cannot be undone">
        <Btn variant="destructive">Reset…</Btn>
      </Row>
    </Section>
  );
}

function AboutPanel() {
  return (
    <Section label="VALLEY">
      <Row title="Version" sub="0.0.1 — Phase 1 MVP">
        <span style={{ color: "var(--text-muted)" }}>main · dev</span>
      </Row>
      <Row title="Source" sub="github.com/frdrckj/valley">
        <span style={{ color: "var(--text-muted)" }}>private</span>
      </Row>
    </Section>
  );
}

/* ─── shared bits ─── */

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

function Switch({ on, onChange }: { on: boolean; onChange?: () => void }) {
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
