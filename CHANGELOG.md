# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-12

### Changed

- Hardened the native ABI boundary and registry handle ownership. Invalid
  UTF-8 or UTF-16 and arguments containing a null character now throw, where
  they previously truncated the argument and read a different registry key.
  An unknown hive name still throws, now reporting `Unknown registry hive`
  rather than `Unable to open registry hive`.
- Added gated MSVC analysis, AddressSanitizer, and PE mitigation checks.
- Made native builds deterministic and removed prebuildify.
- Replaced Mocha with Node.js's built-in test runner.
- Adopted node-gyp 13. Building from source now requires Node
  `^22.22.2 || ^24.15.0 || >=26.0.0`.

### Node.js support

Node 20 reached end-of-life on 2026-04-30 and was removed from the CI matrix
in 1.2.0. Prebuilt binaries target N-API 8 and still load on Node 20, but that
combination is no longer tested, and building from source requires Node 22.22
or later.

## [1.2.0] - 2026-08-09

### Changed

- Added signed, verified npm staged releases with maintainer 2FA approval.
- Documented stage-only Trusted Publishing and enforced npm 11.15+.
- Added 14-day dependency and GitHub Action cooldowns.
- Added cooldown-aware dependency updates and preflight checks.
- Refreshed development dependencies.
- Fixed CI tests after the TypeScript loader migration.
- Limited CI to Node 22, 24, and 26; Node 20 is no longer tested.

## [1.1.0] - 2026-02-25

### Fixed

- Native addon: added missing `return` after `napi_throw_error` in all six argument-length checks, preventing fall-through into subsequent code.
- `GetStringRegKey` now returns `undefined` (instead of `""`) when a registry value does not exist, matching the TypeScript signature and `GetDWORDRegKey` behavior.
- `GetStringRegKey` now validates the registry value type (`REG_SZ` / `REG_EXPAND_SZ`) before returning, preventing garbage data from non-string value types.

### Added

- Cross-platform support: the package now installs cleanly on all platforms and architectures without needing `optionalDependencies` or platform guards.
- CI test matrix for Ubuntu and macOS (Node 20, 22, 24, 25).
- README section documenting cross-platform behavior.
- Test for `GetStringRegKey` returning `undefined` for non-existent values.
- Test for `GetDWORDRegKey` argument-length validation on the hive parameter.

### Changed

- Switched from ANSI registry APIs (`RegOpenKeyExA` / `RegQueryValueExA`) to Unicode (`RegOpenKeyExW` / `RegQueryValueExW`) with UTF-8/UTF-16 conversion, fixing silent corruption of non-ASCII registry paths, names, and values.
- `GetStringRegKey` now throws an error when a registry value exceeds the internal buffer size instead of silently returning an empty result.
- All `napi_*` calls now check return status via a `NAPI_CALL` macro.
- Added `WIN32_LEAN_AND_MEAN` to reduce Windows header bloat.
- `GetHive` now takes `const std::string&` instead of copying by value.
- `GetStringRegKey` and `GetDWORDRegKey` return `undefined` on non-Windows platforms instead of throwing an error.
- Removed `os` and `cpu` restrictions from `package.json`.
- Lint and publish CI jobs now run on `ubuntu-latest`.

## [1.0.0] - 2026-02-23

Initial release as `@photostructure/windows-registry`, forked from
`@vscode/windows-registry`.

### Added

- Pre-built native binaries for Windows x64 and ARM64 (via `prebuildify`).
- OIDC-based npm publishing via GitHub Actions.
- Windows security hardening compiler flags.
- `GetDWORDRegKey` function for reading DWORD registry values.
- Argument length validation for native functions.

### Changed

- Rewrote `binding.gyp` to support both x64 and ARM64 architectures.
- Switched from `.npmignore` to `files` include-list in `package.json`.
- Updated CI to test across Node 20, 22, 24, and 25 on Windows.

[1.1.0]: https://github.com/photostructure/vscode-windows-registry/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/photostructure/vscode-windows-registry/releases/tag/v1.0.0
