/* SPDX-License-Identifier: GPL-3.0-or-later */

import assert from "node:assert/strict";
import test from "node:test";

import type { JSONValue } from "@mangareader/extension-sdk";

import extension from "../src/main.js";

function object(value: JSONValue): Record<string, JSONValue> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value;
}

void test("fixture flow covers search, details, installments, and image pages", async () => {
  const search = await extension.search({ query: "moon" });
  assert.equal(search.items.length, 1);
  const result = object(search.items[0] ?? null);
  assert.equal(result.id, "moon-garden");

  const details = object(await extension.details(String(result.id)));
  assert.equal(details.title, "The Moon Garden");

  const installments = await extension.installments(details);
  assert.equal(installments.length, 1);
  const installment = object(installments[0] ?? null);

  const sequence = object(await extension.imagePages(installment));
  assert.ok(Array.isArray(sequence.pages));
  assert.equal(sequence.pages.length, 2);
});
