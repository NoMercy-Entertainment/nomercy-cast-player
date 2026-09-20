import { beforeEach, describe, expect, it } from 'vitest';

import { allowDiagnosticsWords, censorLabel, resetDiagnosticsWords } from './censor';

describe('censorLabel', () => {
	beforeEach(() => {
		resetDiagnosticsWords();
	});

	it('removes a media title', () => {
		expect(censorLabel('The Matrix Reloaded')).toBeUndefined();
	});

	it('removes an artist name but keeps the track id beside it', () => {
		expect(censorLabel('Rammstein 4821')).toBe('4821');
	});

	it('removes a bearer token', () => {
		expect(censorLabel('videoHub eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig')).toBe('videoHub');
	});

	it('removes an email address', () => {
		expect(censorLabel('Watch stoney@nomercy.tv')).toBeUndefined();
	});

	it('removes an absolute file path', () => {
		expect(censorLabel('mediaReady C:\\Users\\patri\\video.mkv')).toBe('mediaReady');
	});

	it('removes a home directory path', () => {
		expect(censorLabel('/home/stoney/library/movie.mkv')).toBeUndefined();
	});

	it('keeps a numeric id', () => {
		expect(censorLabel('12345')).toBe('12345');
	});

	it('keeps a uuid id', () => {
		expect(censorLabel('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
	});

	it('keeps a route shape and its id parameter', () => {
		expect(censorLabel('GET /api/v1/libraries/8821/movie/455')).toBe('GET /api/v1/libraries/8821/movie/455');
	});

	it('keeps a query key and removes its value', () => {
		expect(censorLabel('GET /api/v1/search?query=the+matrix')).toBe('GET /api/v1/search?query=');
	});

	it('keeps a shape-only query value', () => {
		expect(censorLabel('GET /api/v1/movie?page=3')).toBe('GET /api/v1/movie?page=3');
	});

	it('removes an access token carried in a query string', () => {
		expect(censorLabel('/socket?access_token=abc123&client_id=9')).toBe('/socket?access_token=&client_id=');
	});

	it('drops the origin and keeps the path', () => {
		expect(censorLabel('https://dev.nomercy.tv/api/v1/home')).toBe('/api/v1/home');
	});

	it('keeps a relative route with more than one segment', () => {
		// Read off the running web app: these used to land as a bare `GET`.
		expect(censorLabel('GET plugins/ui/browse')).toBe('GET plugins/ui/browse');
	});

	it('keeps a route that begins with a word a disk path also uses', () => {
		expect(censorLabel('GET /media/1399')).toBe('GET /media/1399');
	});

	it('removes a media file name carried on a path', () => {
		expect(censorLabel('/library/8821/The.Matrix.1999.mkv')).toBeUndefined();
	});

	it('keeps a kit event name', () => {
		expect(censorLabel('playlistReady 991')).toBe('playlistReady 991');
	});

	it('keeps a media label the receiver builds from a type and an id', () => {
		expect(censorLabel('stalled tv-1399')).toBe('stalled tv-1399');
	});

	it('keeps an error class name', () => {
		expect(censorLabel('HttpError')).toBe('HttpError');
	});

	it('keeps a keyboard code', () => {
		expect(censorLabel('ArrowLeft')).toBe('ArrowLeft');
	});

	it('keeps a registered screen name', () => {
		allowDiagnosticsWords(['Now Playing']);
		expect(censorLabel('Now Playing 77')).toBe('Now Playing 77');
	});

	it('drops a screen name that was never registered', () => {
		expect(censorLabel('Now Playing 77')).toBe('77');
	});

	it('returns undefined for an empty label', () => {
		expect(censorLabel('')).toBeUndefined();
	});
});
