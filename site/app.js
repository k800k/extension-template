/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

const catalogURL = "./dist/v1/stable/catalog.json";
const manifestURL = "./dist/v1/stable/mangareader-repository.json";

async function load() {
  const [catalogResponse, manifestResponse] = await Promise.all([
    fetch(catalogURL),
    fetch(manifestURL),
  ]);
  if (!catalogResponse.ok || !manifestResponse.ok)
    throw new Error("Repository metadata is unavailable");
  const catalog = await catalogResponse.json();
  const manifest = await manifestResponse.json();
  const repository = manifest.repository;

  document.title = repository.name;
  document.querySelector("#repository-name").textContent = repository.name;
  document.querySelector("#repository-description").textContent = repository.description;
  document.querySelector("#repository-url").textContent = catalog.repositoryURL;
  document.querySelector("#template-warning").hidden = !catalog.templateMode;
  document.querySelector("#source-count").textContent = String(catalog.sources.length);
  document.querySelector("#empty-state").hidden = catalog.sources.length > 0;

  const container = document.querySelector("#sources");
  for (const source of catalog.sources) {
    const article = document.createElement("article");
    article.className = "source";
    const heading = document.createElement("h3");
    heading.textContent = source.name;
    const description = document.createElement("p");
    description.textContent = source.description;
    const link = document.createElement("a");
    link.href = source.universalLink;
    link.textContent = source.availability === "available" ? "Install" : "Review required";
    article.append(heading, description, link);
    container.append(article);
  }
}

load().catch((error) => {
  document.querySelector("#repository-description").textContent = error.message;
});
