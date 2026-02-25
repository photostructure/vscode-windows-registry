/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'node:path';
import nodeGypBuild = require('node-gyp-build');

// Use node-gyp-build to load the prebuilt native binary for the current
// platform/arch. It checks prebuilds/ first, then falls back to build/Release/.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowRegistry: any = process.platform === 'win32'
	? nodeGypBuild(join(__dirname, '..'))
	: null;

export type HKEY = "HKEY_CURRENT_USER" | "HKEY_LOCAL_MACHINE" | "HKEY_CLASSES_ROOT" | "HKEY_USERS" | "HKEY_CURRENT_CONFIG";

export function GetStringRegKey(hive: HKEY, path: string, name: string): string | undefined {
	return windowRegistry?.GetStringRegKey(hive, path, name);
}

export function GetDWORDRegKey(hive: HKEY, path: string, name: string): number | undefined {
	return windowRegistry?.GetDWORDRegKey(hive, path, name);
}
