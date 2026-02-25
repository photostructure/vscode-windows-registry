# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Removed the `install` script (`node-gyp-build`) -- prebuilds don't require compilation at installation time.
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
