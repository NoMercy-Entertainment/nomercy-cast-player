// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { build } from 'vite';

// Separate from docs: no fixtures or probe globals ship in the production receiver.
const outDir = process.argv[2] ?? '.compat-proof';
await build({
	base: '/__proof/',
	build: {
		outDir,
		rollupOptions: {
			input: resolve('tests/browser/cast-compatibility.html'),
		},
	},
});
copyFileSync(join(outDir, 'tests/browser/cast-compatibility.html'), join(outDir, 'index.html'));
