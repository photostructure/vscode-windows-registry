#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

if (process.platform !== "win32" || process.arch !== "x64") {
  console.log("Native sanitizer tests skipped: MSVC ASan requires win32-x64");
  process.exit(0);
}

const root = process.cwd();
const configText = readFileSync(join(root, "build", "config.gypi"), "utf8").replace(
  /^#.*\r?\n/,
  "",
);
const config = JSON.parse(configText) as { variables: { msbuild_path?: string } };
const msbuildPath = config.variables.msbuild_path;
if (!msbuildPath) throw new Error("node-gyp did not record an MSBuild path");

const visualStudioRoot = resolve(dirname(msbuildPath), "..", "..", "..");
const toolsetsRoot = join(visualStudioRoot, "VC", "Tools", "MSVC");
const toolsets = readdirSync(toolsetsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const toolset = toolsets[toolsets.length - 1];
if (!toolset) throw new Error(`No MSVC toolset found under ${toolsetsRoot}`);

const runtimeDirectory = join(toolsetsRoot, toolset, "bin", "Hostx64", "x64");
const runtime = join(runtimeDirectory, "clang_rt.asan_dynamic-x86_64.dll");
if (!existsSync(runtime)) throw new Error(`MSVC ASan runtime not found: ${runtime}`);

const environment: NodeJS.ProcessEnv = {
  ...process.env,
  ASAN_OPTIONS: "halt_on_error=1:abort_on_error=1:detect_leaks=0:symbolize=1",
};
const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
environment[pathKey] = `${runtimeDirectory}${delimiter}${environment[pathKey] ?? ""}`;

function runNode(arguments_: string[]) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: root,
    env: environment,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  return { ...result, output };
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  name: string;
};
const binary = resolve(
  root,
  "prebuilds",
  "win32-x64",
  `${packageJson.name.replace("/", "+")}.glibc.node`,
);
const canary = runNode([
  "-e",
  "const addon = require(process.argv[1]); addon.__triggerAsanCanary(1)",
  binary,
]);
if (
  canary.status === 0 ||
  !/AddressSanitizer:\s*heap-buffer-overflow/i.test(canary.output)
) {
  throw new Error("ASan canary did not produce the expected heap-buffer-overflow report");
}
console.log("Verified MSVC AddressSanitizer with a heap-buffer-overflow canary");

const suite = runNode([
  join(root, "node_modules", "tsx", "dist", "cli.mjs"),
  "--test",
  "test/**/*.test.ts",
]);
if (suite.status !== 0 || /ERROR:\s*AddressSanitizer/i.test(suite.output)) {
  throw new Error(`Sanitized test suite failed with exit code ${suite.status ?? "unknown"}`);
}
