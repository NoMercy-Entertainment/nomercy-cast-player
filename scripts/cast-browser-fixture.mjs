// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
const require = createRequire(`${root}/package.json`);
const { transform } = require('lightningcss');

const { transformCastLayoutCss } = await import(pathToFileURL(`${root}/scripts/castLayoutCss.mjs`).href);
const css = `
#proof-fixture { position:fixed; inset:0; width:1000px; z-index:99999; background:white; color:black; }
#proof-fixture .item { width:20px; height:20px; flex:none; padding:0; border:0; }
#proof-fixture .row { display:flex; gap:16px; height:30px; }
#proof-fixture .column { display:flex; flex-direction:column; gap:12px; }
#proof-fixture .margins .item { margin-left:3px; margin-right:5px; }
#proof-fixture .reverse { flex-direction:row-reverse; justify-content:flex-end; }
#proof-fixture .rtl { direction:rtl; justify-content:flex-end; }
#proof-fixture .hidden { display:none; }
#proof-fixture .absolute { position:absolute; }
#proof-fixture .grid { display:grid; grid-template-columns:20px 20px; gap:20px; }
#proof-fixture .ratio { width:160px; aspect-ratio:16 / 9; box-sizing:border-box; padding:0; border:0; }
#proof-fixture .ratio.resized { width:320px; }
#proof-fixture .fixed { width:160px; height:40px; aspect-ratio:16 / 9; }
#proof-fixture .basis-parent { display:flex; flex-direction:column; width:300px; height:100px; }
#proof-fixture .basis-child { flex:0 1 90px; width:auto; aspect-ratio:16 / 9; align-self:flex-start; min-height:0; }
#proof-fixture .scaled { width:160px; aspect-ratio:16 / 9; transform:scale(1.2); transform-origin:top left; }
#proof-fixture button:focus-visible { outline:4px solid rgb(255,0,0); }
#proof-fixture :where(.where-child) { padding-left:13px; }
`;
const compiled = transform({ filename: 'proof.css', code: Buffer.from(transformCastLayoutCss(css)), targets: { chrome: 80 << 16 } }).code.toString();
const groups = ['row', 'row margins', 'column', 'row reverse', 'row rtl', 'grid'].map((classes, index) => `<div id="layout-${index}" class="${classes}"><div class="item"></div><div class="item"></div></div>`).join('');
const html = `${groups}<div id="hidden-gap" class="row"><div class="item"></div><div class="item hidden"></div><div class="item absolute"></div><div class="item"></div></div><div id="ratio" class="ratio"></div><div id="fixed-ratio" class="fixed"></div><div id="scaled-ratio" class="scaled"></div><button id="focus-proof">Focus</button><span class="where-child">Where</span><div class="basis-parent"><div id="basis-ratio" class="basis-child"></div></div>`;
const expression = `(async()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(compiled)};document.head.append(style);const host=document.createElement('div');host.id='proof-fixture';host.innerHTML=${JSON.stringify(html)};document.body.append(host);const settle=()=>new Promise(resolve=>setTimeout(resolve,180));await settle();const rect=id=>document.querySelector(id).getBoundingClientRect();const gap=id=>{const el=document.querySelector(id),a=el.children[0].getBoundingClientRect(),b=el.children[1].getBoundingClientRect();return id==='#layout-2'?b.top-a.bottom:Math.max(b.left-a.right,a.left-b.right);};const results=[];const check=(name,actual,expected)=>results.push({name,actual,expected,pass:Math.abs(actual-expected)<0.6});check('row gap',gap('#layout-0'),16);check('existing margins plus gap',gap('#layout-1'),24);check('column gap',gap('#layout-2'),12);check('row reverse gap',gap('#layout-3'),16);check('rtl gap',gap('#layout-4'),16);check('grid native gap',gap('#layout-5'),20);{const el=document.querySelector('#hidden-gap');check('hidden and absolute children ignored',el.children[3].getBoundingClientRect().left-el.children[0].getBoundingClientRect().right,16);}check('width-driven aspect ratio',rect('#ratio').height,90);check('explicit height wins',rect('#fixed-ratio').height,40);check('scaled ratio uses layout size',document.querySelector('#scaled-ratio').offsetHeight,90);check('where fallback',parseFloat(getComputedStyle(document.querySelector('.where-child')).paddingLeft),13);document.querySelector('#focus-proof').focus();check('keyboard focus outline',parseFloat(getComputedStyle(document.querySelector('#focus-proof')).outlineWidth),4);document.querySelector('#ratio').classList.add('resized');await settle();check('ratio resize',rect('#ratio').height,180);const dynamic=document.createElement('div');dynamic.className='item';document.querySelector('#layout-0').append(dynamic);await settle();check('dynamic child gap',dynamic.getBoundingClientRect().left-dynamic.previousElementSibling.getBoundingClientRect().right,16);host.remove();style.remove();return results;})()`;
const basisCheck = 'check(\'column flex-basis sets ratio width\',rect(\'#basis-ratio\').width,160);';
writeFileSync(process.argv[3], JSON.stringify({ expression: expression.replace('host.remove();', `${basisCheck}host.remove();`), css: compiled }, null, 2));
