/* SPDX-License-Identifier: GPL-3.0-or-later */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function run(directory, ...arguments_) {
  return spawnSync(process.execPath, ["packages/cli/bin/mr-ext.mjs", ...arguments_], {
    cwd: directory,
    encoding: "utf8",
  });
}

async function sandbox() {
  const directory = await mkdtemp(join(os.tmpdir(), "mr-template-"));
  await cp(root, directory, {
    recursive: true,
    filter: (source) =>
      ![".git", "node_modules", ".secrets", "dist", "extensions"].includes(source.split("/").pop()),
  });
  await mkdir(join(directory, "extensions", "content"), { recursive: true });
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), "dir");
  return directory;
}

function zipEntries(bytes) {
  const names = [];
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const filenameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    names.push(bytes.subarray(offset + 30, offset + 30 + filenameLength).toString("utf8"));
    offset += 30 + filenameLength + extraLength + compressedSize;
  }
  return names.sort((a, b) => a.localeCompare(b));
}

test("fresh clone can generate, bundle, sign, and detect tampering", async () => {
  const directory = await sandbox();
  let result = run(
    directory,
    "setup",
    "--owner",
    "fixture-owner",
    "--repository",
    "fixture-repository",
    "--publisher-name",
    "Fixture Publisher",
    "--repository-id",
    "fixture.extensions",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await lstat(join(directory, ".secrets", "publisher-key.pem"))).mode & 0o077, 0);

  result = run(
    directory,
    "new",
    "--id",
    "FixtureSource",
    "--name",
    "Fixture Source",
    "--host",
    "reader.example.com",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(
    run(
      directory,
      "new",
      "--id",
      "FixtureSource",
      "--name",
      "Duplicate",
      "--host",
      "reader.example.com",
    ).status,
    0,
  );

  assert.equal(run(directory, "check").status, 0);
  assert.equal(run(directory, "bundle").status, 0);
  const packagePath = join(
    directory,
    "dist",
    "v1",
    "stable",
    "packages",
    "FixtureSource-0.1.0.mrx",
  );
  const first = await readFile(packagePath);
  assert.deepEqual(
    new Set(zipEntries(first)),
    new Set(["LICENSE", "NOTICE", "extension.json", "main.js"]),
  );
  assert.equal(run(directory, "bundle").status, 0);
  assert.deepEqual(await readFile(packagePath), first);

  result = run(directory, "publish");
  assert.notEqual(result.status, 0, "adding a source must invalidate the earlier signature");
  result = run(directory, "publish", "--key", join(directory, ".secrets", "publisher-key.pem"));
  assert.equal(result.status, 0, result.stderr);

  await writeFile(join(directory, "dist", "v1", "stable", "mangareader-repository.sig"), "AAAA\n");
  assert.notEqual(run(directory, "publish").status, 0);

  const rootFiles = await readdir(directory);
  assert.equal(
    rootFiles.some((name) => /publisher-key|\.pem$|\.key$/.test(name)),
    false,
  );
});
