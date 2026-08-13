#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const IMAGE_FILE_MACHINE_AMD64 = 0x8664;
const IMAGE_FILE_MACHINE_ARM64 = 0xaa64;
const IMAGE_NT_OPTIONAL_HDR64_MAGIC = 0x20b;
const IMAGE_DLLCHARACTERISTICS_HIGH_ENTROPY_VA = 0x0020;
const IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE = 0x0040;
const IMAGE_DLLCHARACTERISTICS_NX_COMPAT = 0x0100;
const IMAGE_DLLCHARACTERISTICS_GUARD_CF = 0x4000;
const IMAGE_DIRECTORY_ENTRY_DEBUG = 6;
const IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG = 10;
const IMAGE_DEBUG_TYPE_EX_DLLCHARACTERISTICS = 20;
const IMAGE_DLLCHARACTERISTICS_EX_CET_COMPAT = 0x01;
// Offset of GuardFlags within IMAGE_LOAD_CONFIG_DIRECTORY64.
const LOAD_CONFIG_GUARD_FLAGS_OFFSET = 0x90;
const IMAGE_GUARD_CF_INSTRUMENTED = 0x00000100;
const IMAGE_GUARD_CF_FUNCTION_TABLE_PRESENT = 0x00000400;
const IMAGE_GUARD_EH_CONTINUATION_TABLE_PRESENT = 0x00400000;

if (process.platform !== "win32") {
  console.log("Native hardening verification skipped: the addon is Windows-only");
  process.exit(0);
}

const argv = process.argv.slice(2);
let arch: string = process.arch;
for (let index = 0; index < argv.length; index += 1) {
  const argument = argv[index];
  if (argument === "--arch") {
    const value = argv[index + 1];
    if (!value) throw new Error("--arch requires a value");
    arch = value;
    index += 1;
  } else if (argument.startsWith("--arch=")) {
    arch = argument.slice("--arch=".length);
  } else {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

if (arch !== "x64" && arch !== "arm64") {
  throw new Error(`Unsupported Windows architecture: ${arch}`);
}

const expectedMachine =
  arch === "x64" ? IMAGE_FILE_MACHINE_AMD64 : IMAGE_FILE_MACHINE_ARM64;
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { name: string };
const binaryPath = join(
  "prebuilds",
  `win32-${arch}`,
  `${packageJson.name.replace("/", "+")}.glibc.node`,
);
if (!existsSync(binaryPath)) throw new Error(`Native binary not found: ${binaryPath}`);

const binary = readFileSync(binaryPath);
if (binary.toString("ascii", 0, 2) !== "MZ") throw new Error("Native binary is not PE/COFF");
const peOffset = binary.readUInt32LE(0x3c);
if (binary.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
  throw new Error("Native binary has an invalid PE signature");
}

const coffOffset = peOffset + 4;
const machine = binary.readUInt16LE(coffOffset);
if (machine !== expectedMachine) {
  throw new Error(
    `Native binary machine is 0x${machine.toString(16)}, expected 0x${expectedMachine.toString(16)}`,
  );
}

const sectionCount = binary.readUInt16LE(coffOffset + 2);
const optionalHeaderSize = binary.readUInt16LE(coffOffset + 16);
const optionalHeaderOffset = coffOffset + 20;
if (binary.readUInt16LE(optionalHeaderOffset) !== IMAGE_NT_OPTIONAL_HDR64_MAGIC) {
  throw new Error("Native binary is not PE32+");
}

const dllCharacteristics = binary.readUInt16LE(optionalHeaderOffset + 0x46);
const requiredCharacteristics = [
  [IMAGE_DLLCHARACTERISTICS_HIGH_ENTROPY_VA, "HIGH_ENTROPY_VA"],
  [IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE, "DYNAMIC_BASE"],
  [IMAGE_DLLCHARACTERISTICS_NX_COMPAT, "NX_COMPAT"],
  [IMAGE_DLLCHARACTERISTICS_GUARD_CF, "GUARD_CF"],
] as const;
for (const [flag, name] of requiredCharacteristics) {
  if ((dllCharacteristics & flag) === 0) throw new Error(`Native binary is missing ${name}`);
}

function rvaToFileOffset(rva: number): number {
  const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const sectionOffset = sectionTableOffset + index * 40;
    const virtualSize = binary.readUInt32LE(sectionOffset + 8);
    const virtualAddress = binary.readUInt32LE(sectionOffset + 12);
    const rawSize = binary.readUInt32LE(sectionOffset + 16);
    const rawOffset = binary.readUInt32LE(sectionOffset + 20);
    const mappedSize = Math.max(virtualSize, rawSize);
    if (rva >= virtualAddress && rva < virtualAddress + mappedSize) {
      return rawOffset + (rva - virtualAddress);
    }
  }
  throw new Error(`PE RVA 0x${rva.toString(16)} is not mapped by any section`);
}

const dataDirectoryOffset = optionalHeaderOffset + 0x70;

// The GUARD_CF header bit only records that the linker was asked for Control
// Flow Guard. Compiler instrumentation is recorded separately in the load
// config, so check both: a linker-only /GUARD:CF build sets the header bit
// while leaving the guard function table empty.
const loadConfigDirectoryOffset =
  dataDirectoryOffset + IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG * 8;
const loadConfigRva = binary.readUInt32LE(loadConfigDirectoryOffset);
if (loadConfigRva === 0) {
  throw new Error("Native binary has no load config directory");
}

const loadConfigOffset = rvaToFileOffset(loadConfigRva);
const loadConfigSize = binary.readUInt32LE(loadConfigOffset);
if (loadConfigSize < LOAD_CONFIG_GUARD_FLAGS_OFFSET + 4) {
  throw new Error("Native binary load config does not record GuardFlags");
}

const guardFlags = binary.readUInt32LE(
  loadConfigOffset + LOAD_CONFIG_GUARD_FLAGS_OFFSET,
);
const requiredGuardFlags: [number, string][] = [
  [IMAGE_GUARD_CF_INSTRUMENTED, "CF_INSTRUMENTED"],
  [IMAGE_GUARD_CF_FUNCTION_TABLE_PRESENT, "CF_FUNCTION_TABLE_PRESENT"],
];
if (arch === "x64") {
  requiredGuardFlags.push([
    IMAGE_GUARD_EH_CONTINUATION_TABLE_PRESENT,
    "EH_CONTINUATION_TABLE_PRESENT",
  ]);
}
for (const [flag, name] of requiredGuardFlags) {
  if ((guardFlags & flag) === 0) throw new Error(`Native binary is missing ${name}`);
}

if (arch === "x64") {
  const debugDirectoryOffset = dataDirectoryOffset + IMAGE_DIRECTORY_ENTRY_DEBUG * 8;
  const debugRva = binary.readUInt32LE(debugDirectoryOffset);
  const debugSize = binary.readUInt32LE(debugDirectoryOffset + 4);
  let cetCompatible = false;

  if (debugRva !== 0 && debugSize >= 28) {
    const debugFileOffset = rvaToFileOffset(debugRva);
    for (let offset = 0; offset + 28 <= debugSize; offset += 28) {
      const entry = debugFileOffset + offset;
      const type = binary.readUInt32LE(entry + 12);
      const dataSize = binary.readUInt32LE(entry + 16);
      const dataOffset = binary.readUInt32LE(entry + 24);
      if (type === IMAGE_DEBUG_TYPE_EX_DLLCHARACTERISTICS && dataSize >= 4) {
        cetCompatible =
          (binary.readUInt32LE(dataOffset) & IMAGE_DLLCHARACTERISTICS_EX_CET_COMPAT) !== 0;
      }
    }
  }

  if (!cetCompatible) throw new Error("Native x64 binary is missing CET_COMPAT");
}

console.log(
  `Verified win32-${arch}: PE32+, HIGH_ENTROPY_VA, DYNAMIC_BASE, NX_COMPAT, ` +
    `GUARD_CF, CF_INSTRUMENTED, CF_FUNCTION_TABLE_PRESENT${
      arch === "x64" ? ", EH_CONTINUATION_TABLE_PRESENT, CET_COMPAT" : ""
    }`,
);
