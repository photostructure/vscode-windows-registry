# @photostructure/windows-registry

> **Fork of [@vscode/windows-registry](https://github.com/microsoft/vscode-windows-registry) with prebuilt binaries.**
>
> The upstream package requires a C++ build toolchain at install time. This fork
> ships prebuilt NAPI binaries for `win32-x64` and `win32-arm64`, so no build
> tools are needed on the target machine.

Native node module to access the Windows Registry.

## Installing

```sh
npm install @photostructure/windows-registry
```

## Using

```javascript
const { GetStringRegKey } = require('@photostructure/windows-registry');
console.log(GetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesPath'));
```

## Development

```sh
npm install
npm run build:native  # builds the prebuilt binary
npm test # builds if necessary, then runs tests
```

## License
[MIT](https://github.com/photostructure/vscode-windows-registry/blob/main/License.txt)

Upstream copyright Microsoft Corporation.

