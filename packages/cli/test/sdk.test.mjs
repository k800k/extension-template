/* SPDX-License-Identifier: GPL-3.0-or-later */

import assert from "node:assert/strict";
import test from "node:test";

import * as sdk from "@mangareader/extension-sdk";

test("SDK exposes a content-only MangaReader API v1 declaration", () => {
  assert.equal(sdk.apiVersion, "1.0");
  assert.equal(
    sdk.defineContentExtension({ id: "demo", apiVersion: "1.0", search() {} }).kind,
    "content",
  );
  assert.equal("defineTrackerExtension" in sdk, false);
  assert.equal("defineThemeExtension" in sdk, false);
  assert.throws(() => sdk.defineContentExtension({ id: "bad id", apiVersion: "1.0" }));
});
