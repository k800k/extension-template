<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Security

Report vulnerabilities privately through GitHub Security Advisories.

Never commit publisher private keys, MangaReader approval keys, credentials, cookies, or service tokens. Extensions must use the brokered `RuntimeContext.http` client and declare every allowed HTTPS host. Direct `fetch`, dynamic code generation, WebAssembly, and runtime imports are rejected.

Publisher signatures authenticate exact manifest bytes. Any executable, capability, host, permission, authentication, or rating change requires rebuilding and renewed MangaReader approval.
