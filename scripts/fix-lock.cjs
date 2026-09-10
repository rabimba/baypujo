#!/usr/bin/env node
// One-off: repair package-lock.json for public CI.
// 1) Add missing @emnapi/runtime@1.11.3 + @emnapi/core@1.11.3 entries
//    (deps of @img/sharp-wasm32 / @tailwindcss/oxide-wasm32-wasi; required
//    by npm ci tree validation against fresh npmjs metadata).
// 2) Rewrite all artifactory `resolved` URLs to registry.npmjs.org.
// Integrities are tarball-content hashes; artifactory mirrors npmjs bytes.
const fs = require("fs");
const path = require("path");

const lockPath = path.join(process.cwd(), "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const pkgs = lock.packages;

const AF = "https://artifactory.g.devqa.gcp.dev.paypalinc.com/artifactory/api/npm/npm-all";
const NPMJS = "https://registry.npmjs.org";

const emnapiRuntime = {
  version: "1.11.3",
  resolved: "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
  integrity: "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
  dev: true,
  license: "MIT",
  optional: true,
  dependencies: { tslib: "^2.4.0" },
};
const emnapiCore = {
  version: "1.11.3",
  resolved: "https://registry.npmjs.org/@emnapi/core/-/core-1.11.3.tgz",
  integrity: "sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg==",
  dev: true,
  license: "MIT",
  optional: true,
  dependencies: { tslib: "^2.4.0", "@emnapi/wasi-threads": "1.2.3" },
};

if (!pkgs["node_modules/@emnapi/runtime"]) pkgs["node_modules/@emnapi/runtime"] = emnapiRuntime;
if (!pkgs["node_modules/@emnapi/core"]) pkgs["node_modules/@emnapi/core"] = emnapiCore;

// npm nested-dep resolution: oxide-wasm32-wasi declares @emnapi/runtime ^1.11.1
// and @emnapi/core ^1.11.1 — satisfied by the top-level 1.11.3 entries above.
// @img/sharp-wasm32 needs @emnapi/runtime ^1.11.3 — satisfied.
// @unrs/resolver-binding-wasm32-wasi pins 1.10.0 and keeps its nested entries.

let rewritten = 0;
for (const v of Object.values(pkgs)) {
  if (typeof v.resolved === "string" && v.resolved.startsWith(AF)) {
    v.resolved = NPMJS + v.resolved.slice(AF.length);
    rewritten++;
  }
}

fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
console.log(`added emnapi entries, rewrote ${rewritten} artifactory URLs -> registry.npmjs.org`);
