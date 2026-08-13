#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const argv = process.argv.slice(2);
let analyze = false;
let sanitize = false;
let arch: string = process.arch;
let target = process.versions.node;
const forwarded: string[] = [];

for (let index = 0; index < argv.length; index += 1) {
  const argument = argv[index];

  if (argument === "--analyze") {
    analyze = true;
  } else if (argument === "--sanitize") {
    sanitize = true;
  } else if (argument === "--arch" || argument === "--target") {
    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a value`);
    index += 1;
    if (argument === "--arch") arch = value;
    else target = value.replace(/^v/, "");
  } else if (argument.startsWith("--arch=")) {
    arch = argument.slice("--arch=".length);
  } else if (argument.startsWith("--target=")) {
    target = argument.slice("--target=".length).replace(/^v/, "");
  } else {
    forwarded.push(argument);
  }
}

if (process.platform !== "win32") {
  console.log("Native build skipped: the addon is Windows-only");
  process.exit(0);
}

if (arch !== "x64" && arch !== "arm64") {
  throw new Error(`Unsupported Windows architecture: ${arch}`);
}
if (sanitize && arch !== "x64") {
  throw new Error("MSVC AddressSanitizer is supported only for win32-x64 builds");
}
if (analyze && sanitize) {
  throw new Error("Native analysis and AddressSanitizer require separate builds");
}

const nodeGyp = join(root, "node_modules", "node-gyp", "bin", "node-gyp.js");
if (!existsSync(nodeGyp)) {
  throw new Error("node-gyp is not installed; run npm ci first");
}

const environment = { ...process.env };
const gypDefines = [environment.GYP_DEFINES?.trim()];
if (analyze) gypDefines.push("native_analysis=1");
if (sanitize) gypDefines.push("native_sanitize=1");
environment.GYP_DEFINES = gypDefines.filter(Boolean).join(" ");

const profile = analyze ? " with MSVC analysis" : sanitize ? " with AddressSanitizer" : "";
console.log(`Building win32-${arch} for Node ${target}${profile}...`);

execFileSync(
  process.execPath,
  [
    nodeGyp,
    "rebuild",
    `--target=${target}`,
    `--arch=${arch}`,
    "--release",
    ...forwarded,
  ],
  { cwd: root, env: environment, stdio: "inherit" },
);

const source = join(root, "build", "Release", "winregistry.node");
if (!existsSync(source) || statSync(source).size <= 2 * 1024) {
  throw new Error(`Native build did not produce a valid binary: ${source}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  name: string;
};
const destinationDirectory = join(root, "prebuilds", `win32-${arch}`);
// Keep the established prebuildify filename so published package boundaries stay stable.
const destination = join(
  destinationDirectory,
  `${packageJson.name.replace("/", "+")}.glibc.node`,
);
mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(source, destination);

console.log(`Native module built: ${destination}`);
