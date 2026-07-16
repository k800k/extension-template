/* SPDX-License-Identifier: GPL-3.0-or-later */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".md", ".html", ".css", ".yml", ".yaml"]);

async function sourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    else if (sourceExtensions.has(extname(entry.name)) || path.endsWith(".husky/pre-push"))
      result.push(path);
  }
  return result;
}

test("source and documentation retain GPL identifiers and InkDex attribution", async () => {
  const files = [];
  for (const directory of [
    "packages",
    "scripts",
    "examples",
    "extensions",
    "site",
    ".github",
    ".husky",
  ]) {
    files.push(...(await sourceFiles(join(root, directory))));
  }
  for (const filename of files) {
    assert.match(
      await readFile(filename, "utf8"),
      /SPDX-License-Identifier: GPL-3\.0-or-later/,
      filename,
    );
  }

  const notice = await readFile(join(root, "NOTICE"), "utf8");
  assert.match(notice, /https:\/\/github\.com\/inkdex\/template-extensions/);
  assert.match(notice, /7408965ea41d31930f8b22bf2fa0867630b70c23/);
  assert.match(await readFile(join(root, "LICENSE"), "utf8"), /GNU GENERAL PUBLIC LICENSE/);
});
