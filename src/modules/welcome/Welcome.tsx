import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/Icon";
import { patchSettings, useSettings } from "@/lib/settings";

/**
 * One-time welcome card. Renders only when settings.onboardingDone is
 * false; dismiss flips that flag and the card never returns. Three
 * concrete things to try on first boot, plus a button that opens
 * Settings so the user can paste their AI key right away.
 */
export function Welcome() {
  const done = useSettings().onboardingDone;
  if (done) return null;

  function dismiss() {
    void patchSettings({ onboardingDone: true });
  }

  function openSettings() {
    void invoke("open_settings_window");
    dismiss();
  }

  return (
    <div className="vy-welcome-backdrop" onMouseDown={dismiss}>
      <div className="vy-welcome" onMouseDown={(e) => e.stopPropagation()}>
        <div className="vy-welcome-head">
          <Icon name="sparkle" size={14} style={{ color: "var(--accent-ai)" }} />
          <span>welcome to valley</span>
        </div>
        <div className="vy-welcome-body">
          <p className="vy-welcome-lede">
            three things worth knowing on day one.
          </p>
          <ol className="vy-welcome-list">
            <li>
              <kbd>⌘P</kbd> — fuzzy switcher for tabs, recent files, files in
              the active cwd, modified-in-git files, and the command palette.
            </li>
            <li>
              <kbd>⌘I</kbd> — AI chat panel.{" "}
              <kbd>⌘L</kbd> attaches the active terminal's selection (or last
              command's output) so you can ask "what's wrong here?" without
              copy-paste.
            </li>
            <li>
              <kbd>⌘⇧↑ / ⌘⇧↓</kbd> — jump between command prompts. Each command
              gets a green / red rail in the gutter so failures are visible at
              a glance. <kbd>⌘⇧C</kbd> copies the most recent block.
            </li>
          </ol>
          <p className="vy-welcome-foot">
            For AI to work, paste an Anthropic or OpenAI key in Settings → AI.
            Stored in macOS Keychain.
          </p>
        </div>
        <div className="vy-welcome-actions">
          <button
            type="button"
            className="vy-welcome-btn vy-welcome-btn--ghost"
            onClick={dismiss}
          >
            skip
          </button>
          <button
            type="button"
            className="vy-welcome-btn vy-welcome-btn--primary"
            onClick={openSettings}
          >
            open settings →
          </button>
        </div>
      </div>
    </div>
  );
}
