/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { describe, it } from 'node:test';

const installScript = join(__dirname, '..', 'install.cjs');

describe('install script', () => {
	if (process.platform === 'win32') {
		it('Delegates to node-gyp-build on Windows', () => {
			// The prebuilds shipped for win32-x64 and win32-arm64 make this a
			// no-op; on any other arch it builds from source.
			//
			// node_modules/.bin must be on PATH, as it is for any lifecycle
			// script: node-gyp-build's bin.js probes for a usable prebuild by
			// shelling out to the bare command `node-gyp-build-test`, and reads
			// "command not found" as "no prebuild", falling back to a source
			// build that needs node-gyp. Asserting without that PATH would test
			// node-gyp-build's own resolution, not this script.
			const binDir = join(__dirname, '..', 'node_modules', '.bin');
			const result = spawnSync(process.execPath, [installScript], {
				encoding: 'utf8',
				env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` },
			});
			assert.strictEqual(result.status, 0, result.stderr);
		});
	} else {
		it('Exits without building when the binding will never be loaded', () => {
			// lib/index.ts only loads the native binding on win32, so building it
			// anywhere else is wasted work that fails outright wherever node-gyp is
			// absent. An empty PATH stands in for that environment: pnpm 12 stopped
			// exposing the bundled node-gyp that made the old node-gyp-build install
			// script appear to work.
			const result = spawnSync(process.execPath, [installScript], {
				encoding: 'utf8',
				env: { ...process.env, PATH: '' },
			});
			assert.strictEqual(result.status, 0, result.stderr);
		});
	}
});
