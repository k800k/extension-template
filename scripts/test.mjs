/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [];

async function discover(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", ".tmp", "dist"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await discover(path);
    else if (/\.test\.(?:mjs|ts)$/.test(entry.name)) files.push(path);
  }
}

await discover(root);
files.sort((a, b) => a.localeCompare(b));
if (!files.length) throw new Error("No tests found");

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
