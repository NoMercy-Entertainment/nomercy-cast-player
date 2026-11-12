/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');

describe('the dev proxy in vite.config.ts (AUD-0006)', () => {
	it('holds no server host name, so a public repo names nobody\'s server', () => {
		expect(config).not.toMatch(/[\w-]+\.nomercy\.tv/);
	});

	it('holds no IPv4 literal and no dashed IP host label', () => {
		expect(config).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
		expect(config).not.toMatch(/\b\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}\b/);
	});

	it('keeps TLS verification on for every proxy entry', () => {
		expect(config).not.toMatch(/secure\s*:\s*false/);
	});

	it('takes the target from CAST_DEV_SERVER_URL', () => {
		expect(config).toContain('CAST_DEV_SERVER_URL');
	});
});
