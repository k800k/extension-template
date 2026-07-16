<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# MangaReader Extension Template

A batteries-included GitHub template for native, content-only MangaReader Extension API v1 repositories. Authors write TypeScript; the toolchain validates it, emits runtime `main.js`, creates deterministic `.mrx` packages, signs the repository manifest, and publishes the catalog with GitHub Pages.

## Start a repository

1. Select **Use this template** on GitHub and create a repository.
2. Install Node.js 20 or later, clone the repository, and run `npm ci`.
3. Personalize it and generate a publisher key:

   ```sh
   npm run setup -- \
     --owner YOUR_GITHUB_OWNER \
     --repository YOUR_REPOSITORY \
     --publisher-name "Your Name" \
     --repository-id com.example.extensions
   ```

4. Store the contents of `.secrets/publisher-key.pem` as the GitHub Actions secret `MANGAREADER_PUBLISHER_PRIVATE_KEY`. Never commit that file.
5. Create a source:

   ```sh
   npm run new -- --id ExampleSource --name "Example Source" --host example.com
   ```

6. Implement `extensions/content/ExampleSource/src/main.ts`, complete its review records, then run:

   ```sh
   npm run conformance
   npm run check
   npm test
   npm run bundle
   npm run publish:dry-run
   ```

## Commands

| Command                   | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm run setup`           | Personalize repository metadata and create a separate Ed25519 publisher key. |
| `npm run new`             | Generate a blocked, review-ready content extension scaffold.                 |
| `npm run check`           | Validate metadata, hosts, review records, and source safety.                 |
| `npm test`                | Run CLI contracts and fixture-backed extension tests.                        |
| `npm run bundle`          | Compile TypeScript and create deterministic `.mrx` packages.                 |
| `npm run publish:dry-run` | Verify the current signature and package hashes.                             |
| `npm run serve`           | Serve the documentation and catalog at `http://127.0.0.1:4173`.              |

`examples/content/ExampleSource` demonstrates the complete search → details → installments → image-pages flow without making network requests. It is outside the publication tree and can never enter the catalog accidentally.

## Trust boundary

Generated extensions begin as `approvalRequired`. Publisher signing proves who produced exact repository bytes; it does not replace MangaReader's independent package approval. `mangaReaderApproval` remains `null` in repository tooling.

Only content extensions are supported. Tracker and theme extension declarations are rejected.

## License and attribution

This template is GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Tooling structure was adapted from Inkdex's GPL-licensed template; Paperback-specific code is not included.
