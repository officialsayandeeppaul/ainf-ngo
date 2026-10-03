#!/usr/bin/env node
/**
 * Upserts KEY=value lines in .env.local from SETENV_* process env.
 * Never prints secret values.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../.env.local", import.meta.url);
let text = readFileSync(file, "utf8");
let changed = 0;

function upsert(key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) {
    if (re.exec(text)?.[0] === line) return;
    text = text.replace(re, line);
  } else {
    text = `${text.replace(/\s*$/, "")}\n${line}\n`;
  }
  changed += 1;
}

for (const [rawKey, value] of Object.entries(process.env)) {
  if (!rawKey.startsWith("SETENV_") || value == null) continue;
  upsert(rawKey.slice("SETENV_".length), value);
}

writeFileSync(file, text);
console.log(`env_keys_updated=${changed}`);
