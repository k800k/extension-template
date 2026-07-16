#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { access, chmod, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { format } from "oxfmt";

import {
  API_VERSION,
  assertContentExtension,
  isAllowedHTTPSHost,
  isSafeID,
} from "../lib/contracts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTENT_ROOT = join(ROOT, "extensions", "content");
const OUTPUT_ROOT = join(ROOT, "dist", "v1", "stable");
const args = process.argv.slice(2);
const command = args.shift();

const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function writeJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json(value));
}

async function writeFormatted(path, source) {
  const result = await format(path, source, { sortImports: true });
  if (result.errors.length > 0) {
    throw new Error(
      `Could not format ${relative(ROOT, path)}: ${result.errors.map((error) => error.message).join(", ")}`,
    );
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, result.code);
}

async function readConfig() {
  return JSON.parse(await readFile(join(ROOT, "repository.config.json"), "utf8"));
}

function neutralSVG(id) {
  const initials =
    id
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "MR";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${id} placeholder"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#16697a"/><stop offset="1" stop-color="#489fb5"/></linearGradient></defs><rect width="256" height="256" rx="48" fill="url(#g)"/><path d="M59 52h138v152H59z" fill="#fff" opacity=".16"/><text x="128" y="148" text-anchor="middle" font-family="system-ui,sans-serif" font-size="68" font-weight="700" fill="#fff">${initials}</text></svg>\n`;
}

function scaffoldSource(id) {
  return `/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 MangaReader Extension Contributors */

import type {
  ContentExtension,
  JSONValue,
  RuntimeContext,
} from "@mangareader/extension-sdk";

let runtime: RuntimeContext | undefined;

function unavailable(operation: string): never {
  throw new Error(\`${id} \${operation} is not implemented\`);
}

const extension = {
  id: ${JSON.stringify(id)},
  apiVersion: "1.0",

  initialize(context) {
    runtime = context;
  },

  async search(_input: JSONValue) {
    if (!runtime) unavailable("initialization");
    await runtime.rateLimit.sleep(0);
    return { items: [] };
  },

  async details(_id: string) {
    return unavailable("details");
  },

  async installments(_work: JSONValue) {
    return unavailable("installments");
  },

  async imagePages(_installment: JSONValue) {
    return unavailable("image pages");
  },
} satisfies ContentExtension;

export default extension;
`;
}

async function createScaffold() {
  const id = option("--id");
  const name = option("--name") ?? id;
  const host = option("--host");
  if (!isSafeID(id)) throw new Error("new requires a path-safe --id");
  if (!name?.trim()) throw new Error("new requires --name");
  if (!isAllowedHTTPSHost(host)) throw new Error("new requires an exact lower-case public --host");

  const directory = join(CONTENT_ROOT, id);
  try {
    await access(directory);
    throw new Error(`Refusing to overwrite ${relative(ROOT, directory)}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const config = await readConfig();
  await mkdir(join(directory, "src"), { recursive: true });
  await mkdir(join(directory, "tests"), { recursive: true });
  await writeFormatted(
    join(directory, "extension.json"),
    json({
      id,
      name,
      description: `MangaReader content extension for ${host}.`,
      kind: "content",
      apiVersion: API_VERSION,
      version: "0.1.0",
      language: "en",
      languages: ["en"],
      contentRating: "SAFE",
      availability: "approvalRequired",
      capabilities: ["search", "details", "installments", "imageSequence"],
      permissions: ["network", "rateLimiting", "redactedLogging"],
      allowedHTTPSHosts: [host],
      authenticationModes: ["none"],
      developers: [{ name: config.publisherName }],
      iconFile: "icon.svg",
      sourceFile: "src/main.ts",
      license: "GPL-3.0-or-later",
    }),
  );
  await writeFormatted(join(directory, "src", "main.ts"), scaffoldSource(id));
  await writeFile(join(directory, "icon.svg"), neutralSVG(id));
  await writeFile(
    join(directory, "specification.md"),
    `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n\n# ${name} specification\n\nStatus: **activation prohibited — implementation and behavioral review incomplete**.\n\nDocument the service API or HTML contract, terms, authentication, pagination, search, details, installments, page delivery, challenge behavior, error cases, and representative fixtures before requesting activation. The reviewed host is \`${host}\`.\n`,
  );
  await writeFile(
    join(directory, "REVIEW_STATUS.md"),
    `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n\n# ${name} review status\n\nActivation review: **pending**. Complete implementation, fixture contracts, live smoke tests, privacy and rights records, host declarations, publisher signing, and MangaReader approval before changing \`approvalRequired\`.\n`,
  );
  await writeFile(
    join(directory, "PRIVACY.md"),
    `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n\n# ${name} privacy assessment\n\nStatus: **pending**. Document every transmitted data category, credential or cookie use, retention behavior, authentication handoff, user control, and the privacy policy for \`${host}\` before activation.\n`,
  );
  await writeFile(
    join(directory, "RIGHTS.md"),
    `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n\n# ${name} rights record\n\nStatus: **authorization review pending**. Record the service terms, API or access authorization, content rights, trademark decision, report contact, reviewer, and review date before activation.\n`,
  );
  await writeFormatted(
    join(directory, "tests", "contract.test.ts"),
    `/* SPDX-License-Identifier: GPL-3.0-or-later */\nimport assert from "node:assert/strict";\nimport test from "node:test";\n\nimport extension from "../src/main.js";\n\nvoid test(${JSON.stringify(`${id} exports its declared identity`)}, () => {\n  assert.equal(extension.id, ${JSON.stringify(id)});\n  assert.equal(extension.apiVersion, "1.0");\n});\n`,
  );
  console.log(`Created ${relative(ROOT, directory)}`);
}

async function contentIDs() {
  await mkdir(CONTENT_ROOT, { recursive: true });
  return (await readdir(CONTENT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function check() {
  const extensionRootEntries = await readdir(join(ROOT, "extensions"), { withFileTypes: true });
  const unsupported = extensionRootEntries.filter(
    (entry) => entry.isDirectory() && entry.name !== "content",
  );
  if (unsupported.length) {
    throw new Error(
      `Unsupported extension directories: ${unsupported.map((entry) => entry.name).join(", ")}`,
    );
  }

  const ids = await contentIDs();
  for (const id of ids) await assertContentExtension(join(CONTENT_ROOT, id), id);
  console.log(`check: ${ids.length} valid content extension${ids.length === 1 ? "" : "s"}`);
  return ids;
}

async function compileExtension(directory, id) {
  const entry = `import extension from ${JSON.stringify(join(directory, "src", "main.ts"))};\ndefineContentExtension(extension);`;
  const result = await build({
    stdin: {
      contents: entry,
      loader: "ts",
      resolveDir: ROOT,
      sourcefile: `${id}.entry.ts`,
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    legalComments: "inline",
    write: false,
    banner: { js: "/* SPDX-License-Identifier: GPL-3.0-or-later */" },
  });
  const output = result.outputFiles?.[0]?.contents;
  if (!output) throw new Error(`No JavaScript output for ${id}`);
  const source = Buffer.from(output);
  if (!source.toString("utf8").includes("defineContentExtension")) {
    throw new Error(`${id} bundle does not register a content extension`);
  }
  return source;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const filename = Buffer.from(name);
    const checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, bytes);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + bytes.length;
  }

  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  const count = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

async function prune(directory, expected, predicate) {
  await mkdir(directory, { recursive: true });
  for (const filename of await readdir(directory)) {
    if (predicate(filename) && !expected.has(filename)) await unlink(join(directory, filename));
  }
}

function installURL(config, id) {
  const url = new URL(config.installBaseURL);
  url.searchParams.set("url", config.repositoryURL);
  url.searchParams.set("source", id);
  return url.toString();
}

async function buildArtifacts() {
  const ids = await check();
  const config = await readConfig();
  const license = await readFile(join(ROOT, "LICENSE"));
  const notice = await readFile(join(ROOT, "NOTICE"));
  const packagesDirectory = join(OUTPUT_ROOT, "packages");
  const iconsDirectory = join(OUTPUT_ROOT, "icons");
  await mkdir(packagesDirectory, { recursive: true });
  await mkdir(iconsDirectory, { recursive: true });

  const sources = [];
  const catalog = [];
  const packageNames = new Set();
  const iconNames = new Set();

  for (const id of ids) {
    const directory = join(CONTENT_ROOT, id);
    const metadata = await assertContentExtension(directory, id);
    const metadataBytes = await readFile(join(directory, "extension.json"));
    const main = await compileExtension(directory, id);
    const archive = zip({
      LICENSE: license,
      NOTICE: notice,
      "extension.json": metadataBytes,
      "main.js": main,
    });

    const packageName = `${id}-${metadata.version}.mrx`;
    packageNames.add(packageName);
    await writeFile(join(packagesDirectory, packageName), archive);

    const iconExtension = extname(metadata.iconFile).toLowerCase();
    const iconName = `${id}${iconExtension}`;
    iconNames.add(iconName);
    const icon = await readFile(join(directory, metadata.iconFile));
    await writeFile(join(iconsDirectory, iconName), icon);

    const source = {
      id,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      icon: `icons/${iconName}`,
      languages: metadata.languages,
      contentRating: metadata.contentRating,
      capabilities: metadata.capabilities,
      developers: metadata.developers,
      universalLink: installURL(config, id),
      rightsDeclaration: "Review the extension rights record before installation.",
      rightsURL: `https://github.com/${config.owner}/${config.repository}/blob/main/extensions/content/${id}/RIGHTS.md`,
      reportURL: config.reportURL,
      entryType: "mangaReaderExtension",
      kind: "content",
      availability: metadata.availability,
      permissions: { values: metadata.permissions },
      connectorPreset: null,
      mangaReaderExtension: {
        apiVersion: API_VERSION,
        packageURL: `packages/${packageName}`,
        sha256: sha256(archive),
        compressedSize: archive.length,
        uncompressedSize: license.length + notice.length + metadataBytes.length + main.length,
        allowedHTTPSHosts: metadata.allowedHTTPSHosts,
        authenticationModes: metadata.authenticationModes,
      },
    };
    sources.push(source);
    catalog.push({
      ...source,
      packageSHA256: source.mangaReaderExtension.sha256,
      license: metadata.license,
    });
  }

  await prune(packagesDirectory, packageNames, (name) => name.endsWith(".mrx"));
  await prune(iconsDirectory, iconNames, (name) => /\.(?:svg|png|jpe?g|webp|ico)$/i.test(name));

  const manifest = {
    schemaVersion: 2,
    repository: {
      id: config.id,
      name: config.name,
      description: config.description,
      homepage: config.homepage,
      privacyURL: config.privacyURL,
      publisher: { name: config.publisherName, publicKey: config.publisherPublicKey },
    },
    sources,
    mangaReaderApproval: null,
  };
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeFile(join(OUTPUT_ROOT, "mangareader-repository.json"), JSON.stringify(manifest));
  await writeJSON(join(OUTPUT_ROOT, "catalog.json"), {
    templateMode: config.templateMode,
    repositoryURL: config.repositoryURL,
    sources: catalog,
  });
  console.log(
    `Bundled ${sources.length} deterministic content package${sources.length === 1 ? "" : "s"}`,
  );
  return manifest;
}

function publicKeyFromRaw(raw) {
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
}

function rawPublicKey(privateKey) {
  return createPublicKey(privateKey).export({ type: "spki", format: "der" }).subarray(-32);
}

async function signManifest(keyPath) {
  const privateKey = createPrivateKey(await readFile(resolve(keyPath)));
  const config = await readConfig();
  const actual = rawPublicKey(privateKey).toString("base64");
  if (actual !== config.publisherPublicKey) {
    throw new Error("Publisher private key does not match repository.config.json");
  }
  const bytes = await readFile(join(OUTPUT_ROOT, "mangareader-repository.json"));
  await writeFile(
    join(OUTPUT_ROOT, "mangareader-repository.sig"),
    `${sign(null, bytes, privateKey).toString("base64")}\n`,
  );
}

async function setupRepository() {
  const owner = option("--owner");
  const repository = option("--repository");
  const publisherName = option("--publisher-name");
  const repositoryID = option("--repository-id");
  if (!owner || !repository || !publisherName || !isSafeID(repositoryID)) {
    throw new Error(
      "setup requires --owner, --repository, --publisher-name, and a path-safe --repository-id",
    );
  }

  const config = await readConfig();
  if (!config.templateMode) throw new Error("Repository setup has already been completed");
  const keyPath = join(ROOT, ".secrets", "publisher-key.pem");
  try {
    await access(keyPath);
    throw new Error("Refusing to overwrite the existing publisher key");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const { privateKey } = generateKeyPairSync("ed25519");
  const privatePEM = privateKey.export({ type: "pkcs8", format: "pem" });
  await mkdir(dirname(keyPath), { recursive: true });
  await writeFile(keyPath, privatePEM, { mode: 0o600 });
  await chmod(keyPath, 0o600);

  const homepage = `https://${owner}.github.io/${repository}/`;
  Object.assign(config, {
    templateMode: false,
    id: repositoryID,
    name: `${publisherName} MangaReader Extensions`,
    owner,
    repository,
    homepage,
    repositoryURL: `${homepage}dist/v1/stable/`,
    privacyURL: `https://github.com/${owner}/${repository}/blob/main/PRIVACY.md`,
    reportURL: `https://github.com/${owner}/${repository}/issues/new/choose`,
    publisherName,
    publisherPublicKey: rawPublicKey(privateKey).toString("base64"),
  });
  await writeJSON(join(ROOT, "repository.config.json"), config);
  await buildArtifacts();
  await signManifest(keyPath);
  console.log(
    `Repository configured. Add ${relative(ROOT, keyPath)} as the MANGAREADER_PUBLISHER_PRIVATE_KEY GitHub Actions secret.`,
  );
}

async function publish() {
  const config = await readConfig();
  if (config.templateMode) throw new Error("Run npm run setup before publishing");
  await buildArtifacts();
  const keyPath = option("--key");
  if (keyPath) await signManifest(keyPath);

  const manifest = await readFile(join(OUTPUT_ROOT, "mangareader-repository.json"));
  const signature = Buffer.from(
    (await readFile(join(OUTPUT_ROOT, "mangareader-repository.sig"), "utf8")).trim(),
    "base64",
  );
  const raw = Buffer.from(config.publisherPublicKey, "base64");
  if (raw.length !== 32 || !verify(null, manifest, publicKeyFromRaw(raw), signature)) {
    throw new Error("Publisher signature verification failed");
  }
  const parsed = JSON.parse(manifest);
  for (const source of parsed.sources) {
    const bytes = await readFile(join(OUTPUT_ROOT, source.mangaReaderExtension.packageURL));
    if (
      bytes.length !== source.mangaReaderExtension.compressedSize ||
      sha256(bytes) !== source.mangaReaderExtension.sha256
    ) {
      throw new Error(`Package hash mismatch: ${source.id}`);
    }
  }
  if (parsed.mangaReaderApproval !== null) {
    throw new Error("Repository tooling must not generate MangaReader approval");
  }
  console.log(
    `Verified publisher signature and ${parsed.sources.length} package hash${parsed.sources.length === 1 ? "" : "es"}`,
  );
}

async function serve() {
  const port = Number(option("--port") ?? 4173);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mrx": "application/zip",
  };
  const server = createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
      if (pathname === "/") pathname = "/index.html";
      const base = pathname.startsWith("/dist/") ? ROOT : join(ROOT, "site");
      const path = resolve(base, `.${pathname}`);
      if (!path.startsWith(`${base}${sep}`)) throw new Error("unsafe path");
      const bytes = await readFile(path);
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`MangaReader extension repository: http://127.0.0.1:${port}`);
  });
}

try {
  switch (command) {
    case "setup":
      await setupRepository();
      break;
    case "new":
      await createScaffold();
      break;
    case "check":
      await check();
      break;
    case "bundle":
      await buildArtifacts();
      break;
    case "publish":
      await publish();
      break;
    case "serve":
      await serve();
      break;
    default:
      console.log("mr-ext setup|new|check|bundle|publish|serve");
      process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
