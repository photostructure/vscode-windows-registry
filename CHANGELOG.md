# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-25

### Added

- Cross-platform support: the package now installs cleanly on all platforms and architectures without needing `optionalDependencies` or platform guards.
- CI test matrix for Ubuntu and macOS (Node 20, 22, 24, 25).
- README section documenting cross-platform behavior.

### Changed

- `GetStringRegKey` and `GetDWORDRegKey` return `undefined` on non-Windows platforms instead of throwing an error.
- Removed `os` and `cpu` restrictions from `package.json`.
- Removed the `install` script (`node-gyp-build`) — prebuilds don't require compilation at installation time.
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
