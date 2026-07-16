/* SPDX-License-Identifier: GPL-3.0-or-later */

import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertContentExtension, isAllowedHTTPSHost, isSafeID } from "../lib/contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const example = join(root, "examples", "content", "ExampleSource");

test("identifier and HTTPS host validation rejects unsafe values", () => {
  assert.equal(isSafeID("Example.Source-1"), true);
  assert.equal(isSafeID("../escape"), false);
  assert.equal(isAllowedHTTPSHost("api.example.com"), true);
  assert.equal(isAllowedHTTPSHost("EXAMPLE.com"), false);
  assert.equal(isAllowedHTTPSHost("localhost"), false);
  assert.equal(isAllowedHTTPSHost("example.local"), false);
});

test("fixture example satisfies the publish contract", async () => {
  const metadata = await assertContentExtension(example, "ExampleSource");
  assert.equal(metadata.kind, "content");
  assert.equal(metadata.license, "GPL-3.0-or-later");
});

test("direct networking is rejected", async () => {
  const temporary = await mkdtemp(join(os.tmpdir(), "mr-contract-"));
  await cp(example, temporary, { recursive: true });
  const path = join(temporary, "src", "main.ts");
  const source = await readFile(path, "utf8");
  await writeFile(path, `${source}\nvoid fetch("https://example.com");\n`);
  await assert.rejects(
    assertContentExtension(temporary, "ExampleSource"),
    /forbidden runtime pattern/,
  );
});
