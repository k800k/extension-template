/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

export const apiVersion = "1.0";

export function defineContentExtension(value) {
  if (!value || typeof value !== "object")
    throw new TypeError("An extension declaration is required");
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value.id ?? "")) throw new TypeError("Invalid extension id");
  if (value.apiVersion !== apiVersion)
    throw new TypeError(`Expected MangaReader API ${apiVersion}`);
  return Object.freeze({ ...value, kind: "content" });
}
