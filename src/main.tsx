import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Note: StrictMode is intentionally disabled. xterm + portable-pty manage
// their own native resources (PTY processes, canvas renderers); the
// strict-mode dev double-mount cycle interleaves cleanup with the async
// `openPty` Promise and ends up with two onData listeners writing every
// keystroke twice. Real production builds never hit the cycle. If we want
// strict-mode-style guarantees back, we'd need to refactor attach() to be
// fully synchronous and idempotent across the same DOM host.
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found in index.html");

createRoot(rootEl).render(<App />);
