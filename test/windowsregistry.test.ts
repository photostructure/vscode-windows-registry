/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetStringRegKey, GetDWORDRegKey } from '../dist/index';
import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { Worker } from 'node:worker_threads';

describe('Windows Registry Tests', () => {
	if (process.platform === 'win32') {
		it('Loads independently in a worker environment', async () => {
			const modulePath = require.resolve('../dist/index');
			const result = await new Promise<{ loaded: boolean; valueType: string }>((resolve, reject) => {
				const worker = new Worker(`
					const { parentPort, workerData } = require('node:worker_threads');
					const registry = require(workerData.modulePath);
					const value = registry.GetDWORDRegKey(
						'HKEY_LOCAL_MACHINE',
						'SOFTWARE\\\\Microsoft\\\\Windows NT\\\\CurrentVersion',
						'InstallDate'
					);
					parentPort.postMessage({
						loaded: typeof registry.GetStringRegKey === 'function',
						valueType: typeof value,
					});
				`, { eval: true, workerData: { modulePath } });
				worker.once('message', resolve);
				worker.once('error', reject);
			});

			assert.strictEqual(result.loaded, true);
			assert.ok(result.valueType === 'number' || result.valueType === 'undefined');
		});

		it('Rejects invalid argument types, hives, and embedded nulls', () => {
			assert.throws(() => (GetStringRegKey as any)(42, 'path', 'name'), /Expected string/);
			assert.throws(() => (GetDWORDRegKey as any)('HKEY_UNKNOWN', 'path', 'name'), /Unknown registry hive/);
			assert.throws(() => GetStringRegKey(
				'HKEY_CURRENT_USER',
				'Software\0ignored',
				'name',
			), /cannot contain null characters/);
			assert.throws(() => GetDWORDRegKey(
				'HKEY_CURRENT_USER',
				'Software',
				'name\0ignored',
			), /cannot contain null characters/);
		});

		describe('@GetStringRegKey', () => {
			it('Retrieves the ProgramFilesPath registry value', () => {
				const prgmFilesPath = GetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesPath');
				assert.ok(prgmFilesPath === '%ProgramFiles%');
			});

			it('Validates argument count', () => {
				assert.throws(() => (GetStringRegKey as any)());
				assert.throws(() => ((GetStringRegKey as any)('HKEY_LOCAL_MACHINE')));
				assert.throws(() => ((GetStringRegKey as any)('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion')));
			});

			it('Validates argument length', () => {
				let reallyLongString = 'areallystring';
				while (reallyLongString.length < 17000) {
					reallyLongString += reallyLongString;
				}

				assert.throws(() => ((GetStringRegKey as any)(
					reallyLongString,
					'SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
					'ProgramFilesPath')));

				assert.throws(() => (GetStringRegKey(
					'HKEY_LOCAL_MACHINE',
					reallyLongString,
					'ProgramFilesPath')));

				assert.throws(() => (GetStringRegKey(
					'HKEY_LOCAL_MACHINE',
					'SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
					reallyLongString)));
			});

			it('Returns undefined for non-existent value', () => {
				const result = GetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'NonExistentStringValue12345');
				assert.ok(result === undefined);
			});
		});
		describe('@GetDWORDRegKey', () => {
			it('Retrieves a DWORD registry value', () => {
				const result = GetDWORDRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'InstallDate');
				assert.ok(result === undefined || typeof result === 'number');
			});

			it('Returns undefined for non-existent value', () => {
				const result = GetDWORDRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'NonExistentDWORDValue12345');
				assert.ok(result === undefined);
			});

			it('Validates argument count', () => {
				assert.throws(() => (GetDWORDRegKey as any)());
				assert.throws(() => ((GetDWORDRegKey as any)('HKEY_LOCAL_MACHINE')));
				assert.throws(() => ((GetDWORDRegKey as any)('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion')));
			});

			it('Validates argument length', () => {
				let reallyLongString = 'areallystring';
				while (reallyLongString.length < 17000) {
					reallyLongString += reallyLongString;
				}

				assert.throws(() => ((GetDWORDRegKey as any)(
					reallyLongString,
					'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
					'InstallDate')));

				assert.throws(() => (GetDWORDRegKey(
					'HKEY_LOCAL_MACHINE',
					reallyLongString,
					'InstallDate')));

				assert.throws(() => (GetDWORDRegKey(
					'HKEY_LOCAL_MACHINE',
					'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
					reallyLongString)));
			});
		});
	} else {
		describe('@GetStringRegKey', () => {
			it('Returns undefined when not on Windows', () => {
				const result = GetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesPath');
				assert.strictEqual(result, undefined);
			});
		});

		describe('@GetDWORDRegKey', () => {
			it('Returns undefined when not on Windows', () => {
				const result = GetDWORDRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'SomeValue');
				assert.strictEqual(result, undefined);
			});
		});
	}
});
