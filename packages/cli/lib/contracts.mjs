/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

export const API_VERSION = "1.0";
export const LICENSE = "GPL-3.0-or-later";

export const capabilities = new Set([
  "browse",
  "discover",
  "search",
  "filters",
  "details",
  "installments",
  "acquisition",
  "imageSequence",
  "updates",
  "managedCollections",
  "settings",
  "authentication",
  "interceptors",
  "cookies",
  "challengeHandoff",
]);

export const permissions = new Set([
  "network",
  "cookies",
  "state",
  "secureState",
  "rateLimiting",
  "redactedLogging",
  "challengeHandoff",
  "authenticationHandoff",
  "managedCollections",
]);

export const authenticationModes = new Set([
  "none",
  "basic",
  "apiKey",
  "oauth2PKCE",
  "visibleWebSession",
]);

const availabilities = new Set(["approvalRequired", "available", "serviceUnavailable"]);
const ratings = new Set(["SAFE", "MATURE", "ADULT"]);
const forbiddenSource = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bWebAssembly\b/,
  /\bimport\s*\(/,
];

function nonempty(value, field) {
  assert.equal(typeof value, "string", `${field} must be a string`);
  assert.ok(value.trim(), `${field} must not be empty`);
}

function stringArray(value, field, allowed, required = false) {
  assert.ok(Array.isArray(value), `${field} must be an array`);
  if (required) assert.ok(value.length, `${field} must not be empty`);
  for (const [index, item] of value.entries()) {
    nonempty(item, `${field}[${index}]`);
    if (allowed) assert.ok(allowed.has(item), `${field} contains unsupported value ${item}`);
  }
  assert.equal(new Set(value).size, value.length, `${field} must not contain duplicates`);
}

export function isSafeID(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

export function isAllowedHTTPSHost(value) {
  return (
    typeof value === "string" &&
    value === value.toLowerCase() &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/.test(
      value,
    ) &&
    value !== "localhost" &&
    !value.endsWith(".local")
  );
}

function validateIcon(bytes, extension, id) {
  if (extension === ".svg") {
    assert.match(
      bytes.toString("utf8", 0, Math.min(bytes.length, 512)),
      /<svg\b/i,
      `${id} icon is not SVG`,
    );
    return;
  }
  if (extension === ".png") {
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${id} icon is not PNG`);
    return;
  }
  if ([".jpg", ".jpeg"].includes(extension)) {
    assert.equal(bytes.subarray(0, 2).toString("hex"), "ffd8", `${id} icon is not JPEG`);
    return;
  }
  if (extension === ".webp") {
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${id} icon is not WebP`);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${id} icon is not WebP`);
    return;
  }
  assert.equal(extension, ".ico", `${id} iconFile has an unsupported extension`);
  assert.equal(bytes.subarray(0, 4).toString("hex"), "00000100", `${id} icon is not ICO`);
}

export async function assertContentExtension(directory, expectedID) {
  const metadata = JSON.parse(await readFile(join(directory, "extension.json"), "utf8"));
  const source = await readFile(join(directory, "src", "main.ts"), "utf8");

  assert.equal(metadata.id, expectedID);
  assert.ok(isSafeID(metadata.id), "extension id must be path-safe");
  assert.equal(metadata.kind, "content", "only content extensions are supported");
  assert.equal(metadata.apiVersion, API_VERSION);
  nonempty(metadata.name, "name");
  nonempty(metadata.description, "description");
  assert.match(metadata.version, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/, "version must use SemVer");
  nonempty(metadata.language, "language");
  stringArray(metadata.languages, "languages", undefined, true);
  assert.ok(metadata.languages.includes(metadata.language), "languages must include language");
  assert.ok(ratings.has(metadata.contentRating), "unsupported content rating");
  assert.ok(availabilities.has(metadata.availability), "unsupported availability");
  stringArray(metadata.capabilities, "capabilities", capabilities);
  stringArray(metadata.permissions, "permissions", permissions, true);
  assert.ok(metadata.permissions.includes("network"), "network permission is required by API v1");
  stringArray(metadata.allowedHTTPSHosts, "allowedHTTPSHosts", undefined, true);
  assert.ok(
    metadata.allowedHTTPSHosts.every(isAllowedHTTPSHost),
    "allowedHTTPSHosts must contain exact public lower-case hostnames",
  );
  stringArray(metadata.authenticationModes, "authenticationModes", authenticationModes, true);
  assert.ok(
    Array.isArray(metadata.developers) && metadata.developers.length,
    "developers must not be empty",
  );
  metadata.developers.forEach((developer, index) =>
    nonempty(developer?.name, `developers[${index}].name`),
  );
  assert.equal(metadata.license, LICENSE);
  assert.equal(metadata.sourceFile, "src/main.ts");

  assert.equal(basename(metadata.iconFile), metadata.iconFile, "iconFile must be package-local");
  const icon = await readFile(join(directory, metadata.iconFile));
  validateIcon(icon, extname(metadata.iconFile).toLowerCase(), expectedID);

  assert.match(source, /export\s+default/);
  assert.match(source, /ContentExtension/);
  assert.doesNotMatch(
    source,
    /(?:Tracker|Theme)Extension/,
    "tracker and theme declarations are unsupported",
  );
  for (const pattern of forbiddenSource)
    assert.doesNotMatch(source, pattern, `main.ts contains forbidden runtime pattern ${pattern}`);

  for (const file of ["specification.md", "REVIEW_STATUS.md", "PRIVACY.md", "RIGHTS.md"]) {
    const text = await readFile(join(directory, file), "utf8");
    assert.ok(text.trim().length > 80, `${file} must contain an independent review record`);
  }

  return metadata;
}
