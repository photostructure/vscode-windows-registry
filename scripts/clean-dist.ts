#!/usr/bin/env node

import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");
if (dirname(dist) !== root || basename(dist) !== "dist") {
  throw new Error(`Refusing to clean unexpected path: ${dist}`);
}

rmSync(dist, { force: true, recursive: true });
