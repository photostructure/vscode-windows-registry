#!/usr/bin/env node
/**
 * Cross-platform native build script that checks for existing builds before rebuilding.
 * Adapted from @photostructure/node-sqlite.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Check if a valid native module exists (>2kB — enough to confirm it's not
 * an empty stub, but well under any real winregistry.node build output).
 */
function findValidNativeModule(dir: string): boolean {
  if (!existsSync(dir)) return false;

  try {
    const files = readdirSync(dir, {
      recursive: true,
      encoding: "utf8",
      withFileTypes: false,
    });
    for (const file of files) {
      if (file.endsWith(".node")) {
        const fullPath = join(dir, file as string);
        const stats = statSync(fullPath);
        if (stats.size > 2 * 1024) {
          return true;
        }
      }
    }
  } catch {
    // Directory might not exist or be accessible
  }
  return false;
}

// Check for existing builds
if (findValidNativeModule("prebuilds")) {
  console.log(
    "Native module already built (found .node file > 2kB), skipping rebuild",
  );
  process.exit(0);
}

if (findValidNativeModule("build/Release")) {
  console.log("Native module already built in build/Release, skipping rebuild");
  process.exit(0);
}

// No existing build found, run prebuildify
console.log("Building native module...");

try {
  // Extra args (e.g. --target, --arch) are forwarded to prebuildify for
  // cross-compilation: `npm run build:native -- --arch arm64`
  const args = process.argv.slice(2);
  const prebuildifyArgs = [
    "prebuildify",
    "--napi",
    "--tag-libc",
    "--strip",
    ...args,
  ];

  execFileSync("npx", prebuildifyArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (!findValidNativeModule("prebuilds")) {
    console.error(
      "Build failed: No valid native module found (expected .node file > 2kB)",
    );
    process.exit(1);
  }

  console.log("Native module built successfully");
} catch (error) {
  console.error("Build failed:", (error as Error).message);
  process.exit(1);
}
