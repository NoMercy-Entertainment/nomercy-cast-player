// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

const { Buffer } = require('node:buffer');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const process = require('node:process');

const DEBUG_ENDPOINT = /DevTools listening on (ws:\/\/\S+)/;
const JSON_SUFFIX = /\.json$/;
const ARTIFACT_FILE = /\.(?:html|js|css|wasm)$/;
// Usage: node scripts/prove-cast-browser.cjs BUILD_DIR REPORT_JSON BROWSER_EXE [LAYOUT_FIXTURE_JSON] [PROOF_BUILD_DIR]
// Run only a local build in a temporary browser profile. No Cast device, account or external site is opened.
if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
	console.error('Usage: node scripts/prove-cast-browser.cjs BUILD_DIR REPORT_JSON BROWSER_EXE [LAYOUT_FIXTURE_JSON] [PROOF_BUILD_DIR]');
	process.exit(2);
}
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const executable = path.resolve(process.argv[4]);
const proofRoot = process.argv[6] ? path.resolve(process.argv[6]) : null;
const artifactHash = createHash('sha256');
const artifactFiles = fs.readdirSync(root, { recursive: true, withFileTypes: true })
	.filter(entry => entry.isFile() && ARTIFACT_FILE.test(entry.name))
	.map(entry => path.join(entry.parentPath, entry.name))
	.sort();
for (const file of artifactFiles) {
	artifactHash.update(path.relative(root, file).replaceAll('\\', '/'));
	artifactHash.update('\0');
	artifactHash.update(fs.readFileSync(file));
	artifactHash.update('\0');
}
const buildSha256 = artifactHash.digest('hex');
fs.mkdirSync(path.dirname(output), { recursive: true });
const profile = fs.mkdtempSync(path.join(path.dirname(output), 'cast-proof-profile-'));
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
	const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
	const selectedRoot = proofRoot && requestPath.startsWith('/__proof/') ? proofRoot : root;
	const relative = selectedRoot === proofRoot ? requestPath.slice('/__proof'.length) : requestPath;
	let file = path.resolve(selectedRoot, `.${relative}`);
	if (!file.startsWith(selectedRoot + path.sep) && file !== selectedRoot) {
		res.writeHead(403).end();
		return;
	}
	if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
		file = path.join(selectedRoot, 'index.html');
	res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
	let body = fs.readFileSync(file);
	if (file.endsWith('index.html'))
		body = body.toString().replace(/<script\s+src="https:\/\/www\.gstatic\.com[^>]+><\/script>/g, '');
	res.end(body);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const child = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
	let ws;
	try {
		const endpoint = await new Promise((resolve, reject) => {
			let text = '';
			const timer = setTimeout(() => reject(new Error('Chrome launch timeout')), 20000);
			child.stderr.on('data', (chunk) => {
				text += chunk;
				const match = text.match(DEBUG_ENDPOINT);
				if (match) {
					clearTimeout(timer);
					resolve(match[1]);
				}
			});
			child.on('error', reject);
		});
		const origin = new URL(endpoint);
		const targets = await (await fetch(`http://${origin.host}/json/list`)).json();
		ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			ws.onopen = resolve;
			ws.onerror = reject;
		});
		let next = 0;
		const pending = new Map();
		const exceptions = [];
		ws.onclose = () => {
			for (const operation of pending.values())
				operation.reject(new Error('Browser connection closed'));
			pending.clear();
		};
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.id) {
				const operation = pending.get(data.id);
				if (operation) {
					pending.delete(data.id);
					if (data.error)
						operation.reject(new Error(JSON.stringify(data.error)));
					else
						operation.resolve(data.result);
				}
			}
			else if (data.method === 'Runtime.exceptionThrown') {
				exceptions.push(data.params.exceptionDetails);
			}
		};
		const call = (method, params = {}) => new Promise((resolve, reject) => {
			const id = ++next;
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}, 15000);
			pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
			ws.send(JSON.stringify({ id, method, params }));
		});
		const evaluate = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result;
		await call('Runtime.enable');
		await call('Page.enable');
		await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
		const before = await evaluate('({ua:navigator.userAgent,hasOwn:typeof Object.hasOwn,at:typeof Array.prototype.at,replaceAll:typeof String.prototype.replaceAll})');
		await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
		await delay(5000);
		const after = await evaluate('({ua:navigator.userAgent,hasOwn:typeof Object.hasOwn,at:typeof Array.prototype.at,replaceAll:typeof String.prototype.replaceAll,appChildren:document.querySelector("#app")?.children.length,text:document.body.innerText.slice(0,1200),aspectRatio:CSS.supports("aspect-ratio","1"),focusVisible:CSS.supports("selector(:focus-visible)")})');
		const assetModules = fs.readdirSync(path.join(root, 'assets')).filter(name => name.endsWith('.js'));
		const imports = await evaluate(`(async()=>{const files=${JSON.stringify(assetModules)};const results=[];for(const name of files){try{await import("/assets/"+name);results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:String(error)});}}return results;})()`);
		const behavior = await evaluate('(()=>{const tests={};const check=(name,fn)=>{try{tests[name]=fn()===true;}catch(error){tests[name]=String(error);}};check("atNegative",()=>[1,2,3].at(-1)===3);check("atBounds",()=>[].at(0)===undefined&&[1].at(Infinity)===undefined);check("atGeneric",()=>Array.prototype.at.call({0:"a",1:"b",length:2},-1)==="b");check("replaceAllTokens",()=>"aba".replaceAll("a","[$&]")==="[a]b[a]");check("replaceAllEmpty",()=>"ab".replaceAll("","-")==="-a-b-");check("replaceAllNonGlobal",()=>{try{"a".replaceAll(/a/,"b");return false;}catch(e){return e instanceof TypeError;}});check("ownNullPrototype",()=>!Object.hasOwn(Object.create(null),"toString"));return tests;})()');
		const wasm = await evaluate('(async()=>{try{const buffer=await(await fetch("/js/octopus/nomercy-libass-worker.wasm")).arrayBuffer();let compileError;try{await WebAssembly.compile(buffer);}catch(error){compileError=String(error);}return {bytes:buffer.byteLength,valid:WebAssembly.validate(buffer),compileError};}catch(error){return {error:String(error)};}})()');
		const moduleFailures = imports.value?.filter(result => !result.ok) || [];
		const previewGeometry = await evaluate('Array.from(document.querySelectorAll("#app *")).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,classes:el.getAttribute("class"),x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,flex:s.flex,ratio:s.getPropertyValue("--cast-aspect-ratio"),inline:el.getAttribute("style")};}).filter(x=>x.width>0&&x.height>0)');
		const previewChecks = await evaluate('(()=>{const checks=[];for(const [selector,ratio] of [[".splash .bg",16/9],[".splash .phone",240/268],[".splash .brand",null]]){const el=document.querySelector(selector),r=el?.getBoundingClientRect();const expected=ratio??(el?.naturalWidth/el?.naturalHeight);checks.push({name:selector,actual:r?.width/r?.height,expected,pass:!!r&&r.height>0&&Math.abs(r.width/r.height-expected)<0.01});}return checks;})()');
		const previewShot = await call('Page.captureScreenshot', { format: 'png' });
		fs.writeFileSync(output.replace(JSON_SUFFIX, '.preview.png'), Buffer.from(previewShot.data, 'base64'));
		// A trusted keyboard event puts native :focus-visible into keyboard modality.
		await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
		await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
		const layout = process.argv[5] ? await evaluate(JSON.parse(fs.readFileSync(process.argv[5], 'utf8')).expression) : null;
		let playerProof;
		if (proofRoot) {
			await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/__proof/` });
			for (let attempt = 0; attempt < 50; attempt++) {
				const ready = await evaluate('typeof window.runCastCompatibilityProof === "function"');
				if (ready.value)
					break;
				await delay(100);
			}
			playerProof = await evaluate('window.runCastCompatibilityProof()');
		}
		const unexpectedFailures = moduleFailures.filter(result => !result.error.includes('Could not resolve "audiomotion-analyzer"'));
		const previewPassed = after.value?.appChildren > 0 && exceptions.length === 0 && unexpectedFailures.length === 0 && Object.keys(behavior.value || {}).length === 7 && Object.values(behavior.value || {}).every(value => value === true);
		const layoutPassed = Array.isArray(layout?.value) && layout.value.length >= 14 && layout.value.every(result => result.pass === true);
		const playerPassed = playerProof?.value?.passed === true;
		const productionLayoutPassed = previewChecks.value?.length === 3 && previewChecks.value.every(result => result.pass === true);
		const passed = previewPassed && layoutPassed && productionLayoutPassed && playerPassed;
		const report = { root, buildSha256, artifactFileCount: artifactFiles.length, mode: 'local non-CAF preview, external DNS blocked', before: before.value, after: after.value, moduleCount: assetModules.length, moduleFailures, apiBehavior: behavior.value, previewGeometry: previewGeometry.value, previewChecks: previewChecks.value, layout: layout?.value, playerProof: playerProof?.value ?? playerProof, subtitleWasm: wasm.value, exceptions, previewPassed, layoutPassed, productionLayoutPassed, playerPassed, passed };
		fs.writeFileSync(output, JSON.stringify(report, null, 2));
		console.log(JSON.stringify({ ...report, previewGeometry: undefined, moduleFailures: moduleFailures.slice(0, 3), totalModuleFailures: moduleFailures.length, exceptions: exceptions.map(e => e.exception?.description || e.text) }, null, 2));
		const shot = await call('Page.captureScreenshot', { format: 'png' });
		fs.writeFileSync(output.replace(JSON_SUFFIX, '.png'), Buffer.from(shot.data, 'base64'));
		await call('Browser.close').catch(() => {});
		if (!passed)
			process.exitCode = 1;
	}
	finally {
		if (ws)
			ws.close();
		if (child.exitCode === null)
			child.kill();
		server.closeAllConnections();
		await new Promise(resolve => server.close(resolve));
		// Only remove the unique profile this invocation created, after the owned browser exits.
		if (child.exitCode === null)
			await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)]);
		const profilePath = path.resolve(profile);
		if (path.dirname(profilePath) === path.dirname(output) && path.basename(profilePath).startsWith('cast-proof-profile-')) {
			try {
				fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 3 });
			}
			catch (error) {
				console.warn('Could not clean proof profile:', error.message);
			}
		}
	}
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
