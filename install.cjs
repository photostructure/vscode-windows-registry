#!/usr/bin/env node

/**
 * The native binding is Windows-only: lib/index.ts loads it exclusively when
 * `process.platform === "win32"`, and every export returns undefined
 * elsewhere. Running node-gyp-build on other platforms therefore compiles an
 * addon that nothing will ever load.
 *
 * It also fails outright wherever node-gyp is not on PATH. That went unnoticed
 * for months because pnpm 11 exposed its own bundled node-gyp to lifecycle
 * scripts; pnpm 12 stopped, turning a pointless build into an install error.
 *
 * On Windows the behavior is unchanged: node-gyp-build finds a shipped
 * prebuild for win32-x64 and win32-arm64, and builds from source on any other
 * arch. It is resolved through require.resolve and run with this process's own
 * interpreter, so it does not depend on the package manager having put
 * node_modules/.bin on PATH -- which a bare `node-gyp-build` spawn does.
 */

const { spawnSync } = require("node:child_process");

if (process.platform !== "win32") {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [require.resolve("node-gyp-build/bin.js")],
  { stdio: "inherit" },
);

if (result.error) {
  console.error("Failed to run node-gyp-build:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
