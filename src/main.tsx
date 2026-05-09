import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Programmatic FontFace registration. The @fontsource @import in index.css
// usually handles this, but in some Vite/Tauri-webview combinations the
// CSS-side @font-face declarations don't fire early enough for xterm's
// canvas-based glyph metrics. Doing it explicitly with FontFace gives us a
// concrete Promise we (and consumers like `useTerminalSession`) can await.
import geistLatinUrl from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url";
import geistLatinExtUrl from "@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2?url";

if (typeof FontFace !== "undefined" && typeof document !== "undefined") {
  const fonts = [
    new FontFace(
      "Geist Mono Variable",
      `url("${geistLatinUrl}") format("woff2-variations")`,
      { weight: "100 900", style: "normal", display: "swap" },
    ),
    new FontFace(
      "Geist Mono Variable",
      `url("${geistLatinExtUrl}") format("woff2-variations")`,
      { weight: "100 900", style: "normal", display: "swap" },
    ),
  ];
  for (const f of fonts) {
    f.load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => {
        /* ignore — CSS @import covers most cases */
      });
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
