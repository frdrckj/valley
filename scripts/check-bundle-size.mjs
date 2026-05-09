#!/usr/bin/env node
import { execSync } from "node:child_process";

const MAX_MB = 12;

function bundleSizeMB() {
  const out = execSync("du -sk src-tauri/target/release/bundle/macos/*.app").toString();
  const kb = Number.parseInt(out.split(/\s+/)[0], 10);
  return kb / 1024;
}

const mb = bundleSizeMB();
console.log(`bundle: ${mb.toFixed(2)} MB`);
if (mb > MAX_MB) {
  console.error(`bundle exceeds budget (${MAX_MB} MB)`);
  process.exit(1);
}
