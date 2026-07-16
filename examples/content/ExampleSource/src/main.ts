/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

import type { ContentExtension, JSONValue } from "@mangareader/extension-sdk";

import { works } from "../fixtures/catalog.js";

function object(value: JSONValue): Record<string, JSONValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: JSONValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function work(id: string) {
  const result = works.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Unknown fixture work: ${id}`);
  return result;
}

const extension = {
  id: "ExampleSource",
  apiVersion: "1.0",

  async search(input: JSONValue) {
    const query = string(object(input).query).toLowerCase();
    return {
      items: works
        .filter((candidate) => candidate.title.toLowerCase().includes(query))
        .map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          imageURL: candidate.coverURL,
        })),
    };
  },

  async details(id: string) {
    const candidate = work(id);
    return {
      id: candidate.id,
      title: candidate.title,
      imageURL: candidate.coverURL,
      synopsis: candidate.synopsis,
      contentRating: "SAFE",
    };
  },

  async installments(input: JSONValue) {
    const candidate = work(string(object(input).id));
    return candidate.installments.map((installment) => ({
      id: installment.id,
      workId: candidate.id,
      number: installment.number,
      title: installment.title,
      language: "en",
    }));
  },

  async imagePages(input: JSONValue) {
    const id = string(object(input).id);
    for (const candidate of works) {
      const installment = candidate.installments.find((item) => item.id === id);
      if (installment) {
        return {
          installmentId: id,
          pages: installment.pages.map((url, index) => ({ id: `${id}-${index + 1}`, url })),
        };
      }
    }
    throw new Error(`Unknown fixture installment: ${id}`);
  },
} satisfies ContentExtension;

export default extension;
