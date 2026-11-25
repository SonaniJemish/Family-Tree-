'use strict';
/*
 * Browser test (needs Playwright):  NODE_PATH=<where playwright is> node tests/e2e.js
 * Opens index.html from disk (the same way you will open it) and clicks through the app.
 */
const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.E2E_OUT || path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
function ok(name) { passed++; console.log('  ok  ' + name); }

async function addViaModal(page, latin, shift) {
  await page.waitForSelector('#modal:not(.hidden)');
  await page.keyboard.type(latin);
  await page.keyboard.press('Enter'); // accept suggestion
  await page.waitForFunction(() => /[઀-૿]/.test(document.querySelector('#nameInput').value) && !/[A-Za-z]/.test(document.querySelector('#nameInput').value), null, { timeout: 8000 });
  await page.keyboard.press(shift ? 'Shift+Enter' : 'Enter'); // save
  if (!shift) await page.waitForSelector('#modal', { state: 'hidden' });
}

async function names(page) {
  return page.evaluate(() => window.FTApp.store.data.people.map((p) => p.name));
}

async function settle(page) { await page.waitForTimeout(600); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/inputtools|Failed to load resource|net::ERR|CORS|fetch/i.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());

  await page.goto(URL);

  // ---- empty state
  assert.equal(await page.isVisible('#empty'), true);
  ok('empty state is shown');

  // ---- first person with Gujlish typing
  await page.click('#btnFirst');
  await addViaModal(page, 'jivraj');
  await settle(page);
  let n = await names(page);
  assert.equal(n.length, 1);
  assert.ok(/^[઀-૿]+$/.test(n[0]), 'name is Gujarati: ' + n[0]);
  assert.equal(await page.isVisible('#empty'), false);
  assert.equal(await page.isVisible('#actionbar'), true);
  ok('first person added via Gujlish, action bar shows on selection');

  // ---- child via action bar, then 3 children with Shift+Enter
  await page.click('#actionbar [data-act="child"]');
  await addViaModal(page, 'akshay');
  await settle(page);
  await page.click('.node >> nth=0'); // select root again
  await page.click('#actionbar [data-act="child"]');
  await addViaModal(page, 'manan', true);
  await addViaModal(page, 'yash', false);
  await settle(page);
  n = await names(page);
  assert.equal(n.length, 4);
  const rootId = await page.evaluate(() => window.FTApp.store.data.people[0].id);
  const kids = await page.evaluate((id) => window.FTApp.store.childrenOf(id).length, rootId);
  assert.equal(kids, 3);
  ok('child + "save and next" create 3 children under one parent');

  // ---- keyboard: Tab = child, Enter = sibling
  await page.click('.node >> nth=1');
  await page.keyboard.press('Tab');
  await addViaModal(page, 'bhavesh');
  await settle(page);
  await page.keyboard.press('Enter'); // sibling of the new node
  await addViaModal(page, 'pravin');
  await settle(page);
  n = await names(page);
  assert.equal(n.length, 6);
  ok('keyboard shortcuts Tab (child) and Enter (sibling)');

  // ---- layout checks from the real DOM
  async function layoutReport() {
    return page.evaluate(() => {
      const st = window.FTApp.store;
      const rects = {};
      document.querySelectorAll('.node').forEach((el) => {
        const r = el.getBoundingClientRect();
        rects[el.getAttribute('data-id')] = { l: r.left, r: r.right, t: r.top, b: r.bottom, cx: (r.left + r.right) / 2 };
      });
      let overlap = 0, notCentred = 0, notBelow = 0, rows = {};
      st.data.people.forEach((p) => { const r = rects[p.id]; const key = Math.round(r.t); (rows[key] = rows[key] || []).push(r); });
      Object.values(rows).forEach((row) => { row.sort((a, b) => a.l - b.l); for (let i = 1; i < row.length; i++) if (row[i - 1].r > row[i].l + 0.5) overlap++; });
      st.data.people.forEach((p) => {
        const kids = st.childrenOf(p.id);
        if (!kids.length) return;
        const first = rects[kids[0].id], last = rects[kids[kids.length - 1].id];
        if (Math.abs((first.cx + last.cx) / 2 - rects[p.id].cx) > 2) notCentred++;
        kids.forEach((k) => { if (rects[k.id].t <= rects[p.id].b) notBelow++; });
      });
      return { count: st.data.people.length, overlap, notCentred, notBelow };
    });
  }
  let rep = await layoutReport();
  assert.equal(rep.count, 6);
  assert.equal(rep.overlap, 0, 'no boxes overlap');
  assert.equal(rep.notCentred, 0, 'parent centred above children');
  assert.equal(rep.notBelow, 0, 'children below parent');
  ok('auto layout: no overlap, parent centred, children below');

  await page.screenshot({ path: path.join(OUT, '1-canvas-small.png') });

  // ---- edit + delete + undo
  await page.dblclick('.node >> nth=0');
  await page.waitForSelector('#modal:not(.hidden)');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('જીવરાજભાઈ'); // typing Gujarati directly must work
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal', { state: 'hidden' });
  n = await names(page);
  assert.equal(n[0], 'જીવરાજભાઈ');
  ok('rename by double click, Gujarati typed directly');

  await page.click('.node >> nth=1'); // a child that has children
  const before = (await names(page)).length;
  await page.click('#actionbar [data-act="delete"]');
  await settle(page);
  const after = (await names(page)).length;
  assert.ok(after < before, 'deleted');
  await page.keyboard.press('Control+z');
  await settle(page);
  assert.equal((await names(page)).length, before);
  ok('delete removes the branch, Ctrl+Z brings it back');

  // ---- sample family (big layout) + screenshots
  const sampleLoaded = await page.evaluate(() => {
    const res = window.FT.io.normalize(window.FT.sample.people, window.FT.sample.title);
    window.FTApp.store.replaceAll(res.data);
    return res.ok;
  });
  assert.ok(sampleLoaded);
  await settle(page);
  rep = await layoutReport();
  assert.equal(rep.overlap, 0);
  assert.equal(rep.notCentred, 0);
  await page.screenshot({ path: path.join(OUT, '2-canvas-sample.png') });
  ok('sample family lays out cleanly (2 roots)');

  // ---- pan + zoom
  const s0 = await page.evaluate(() => window.FTApp.pz.getState());
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(100);
  const s1 = await page.evaluate(() => window.FTApp.pz.getState());
  assert.ok(s1.k > s0.k, 'wheel zooms in');
  // find an empty spot (dragging on a box must not pan, dragging on the background must)
  const spot = await page.evaluate(() => {
    for (let x = 40; x < 400; x += 40) for (let y = 120; y < 800; y += 40) {
      const e = document.elementFromPoint(x, y);
      if (e && e.id === 'stage') return { x, y };
    }
    return null;
  });
  assert.ok(spot, 'found empty background');
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 80, spot.y + 40, { steps: 4 });
  await page.mouse.up();
  const s2 = await page.evaluate(() => window.FTApp.pz.getState());
  assert.ok(Math.abs(s2.x - s1.x - 80) < 2 && Math.abs(s2.y - s1.y - 40) < 2, 'drag pans');
  await page.click('#zFit');
  await settle(page);
  ok('wheel zoom, drag pan, fit button');

  // ---- tree (ped) view
  await page.click('#tabTree');
  await settle(page);
  assert.equal(await page.isVisible('#treeLayer svg'), true);
  const tagCount = await page.evaluate(() => document.querySelectorAll('#treeLayer svg text').length);
  assert.equal(tagCount, 17 + 1); // 17 people + title
  await page.screenshot({ path: path.join(OUT, '3-tree-sample.png') });
  ok('tree (ped) view draws all names + title');
  await page.click('#tabCanvas');
  await settle(page);

  // ---- export JSON, CSV, PNG
  async function exportAs(kind) {
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#btnExport'); await page.click('[data-exp="' + kind + '"]'); })()]);
    const file = path.join(OUT, dl.suggestedFilename());
    await dl.saveAs(file);
    return file;
  }
  const jsonFile = await exportAs('json');
  const csvFile = await exportAs('csv');
  const pngFile = await exportAs('png');
  const png = fs.readFileSync(pngFile);
  assert.equal(png.slice(1, 4).toString(), 'PNG');
  assert.ok(png.length > 5000);
  ok('JSON, CSV and PNG downloads work');

  const exported = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(exported.people.length, 17);
  assert.ok(fs.readFileSync(csvFile, 'utf8').includes('જીવરાજભાઈ'));
  assert.equal(await page.isVisible('#dirty'), false);

  // ---- reload keeps data (browser auto-save)
  await page.reload();
  await settle(page);
  assert.equal((await names(page)).length, 17);
  ok('auto-save: data is still there after reload');

  // ---- Google suggestion path (fetch is mocked with the response shape Google Input Tools uses)
  await page.evaluate(() => {
    window.fetch = () => Promise.resolve({ json: () => Promise.resolve(['SUCCESS', [['jemish', ['જેમિશ', 'જેમીશ', 'જેમિષ'], [], {}]]]) });
  });
  await page.click('#btnRoot');
  await page.waitForSelector('#modal:not(.hidden)');
  await page.keyboard.type('jemish');
  await page.waitForFunction(() => document.querySelector('#sugHint').textContent === 'Google suggestions', null, { timeout: 5000 });
  const sugs = await page.$$eval('#sugList .gu', (els) => els.map((e) => e.textContent));
  assert.deepEqual(sugs, ['જેમિશ', 'જેમીશ', 'જેમિષ']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await page.inputValue('#nameInput'), 'જેમીશ');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#modal', { state: 'hidden' });
  assert.equal((await names(page)).length, 17, 'cancel adds nothing');
  ok('Google suggestions list, arrow keys, Enter pick, Escape cancel');

  // ---- big family: 400 people, uneven (some have 1 child, some 3+)
  const big = await page.evaluate(() => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const people = [];
    for (let i = 1; i <= 400; i++) {
      const parent = i <= 3 ? null : 'p' + (1 + Math.floor(Math.pow(rnd(), 1.6) * (i - 1)));
      people.push({ id: 'p' + i, name: 'નામ' + i + (i % 7 === 0 ? 'ભાઈ' : ''), parent });
    }
    const res = window.FT.io.normalize(people, 'મોટું કુટુંબ');
    let t = performance.now();
    window.FTApp.store.replaceAll(res.data);
    const canvasMs = performance.now() - t;
    t = performance.now();
    const b = window.FT.TreeView.build(window.FTApp.store.data);
    return { canvasMs: Math.round(canvasMs), treeMs: Math.round(performance.now() - t), w: b.width, h: b.height };
  });
  assert.ok(big.canvasMs < 1500 && big.treeMs < 1500, 'fast enough: ' + JSON.stringify(big));
  await settle(page);
  rep = await layoutReport();
  assert.equal(rep.count, 400);
  assert.equal(rep.overlap, 0);
  assert.equal(rep.notCentred, 0);
  assert.equal(rep.notBelow, 0);
  console.log('      (400 people: canvas ' + big.canvasMs + ' ms, tree build ' + big.treeMs + ' ms, tree size ' + big.w + 'x' + big.h + ')');
  await page.screenshot({ path: path.join(OUT, '5-canvas-400.png') });
  await page.click('#tabTree');
  await settle(page);
  await page.screenshot({ path: path.join(OUT, '6-tree-400.png') });
  await page.click('#tabCanvas');
  await page.evaluate(() => { const res = window.FT.io.normalize(window.FT.sample.people, window.FT.sample.title); window.FTApp.store.replaceAll(res.data); });
  await settle(page);
  ok('400 people: no overlaps, fast, both views draw');

  // ---- import into a brand-new browser profile (this is the "file is my database" flow)
  for (const f of [jsonFile, csvFile]) {
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 850 } });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push('pageerror(import): ' + e.message));
    p2.on('dialog', (d) => d.accept());
    await p2.goto(URL);
    await p2.setInputFiles('#fileInput', f);
    await p2.waitForTimeout(700);
    const got = await p2.evaluate(() => window.FTApp.store.data.people);
    assert.deepEqual(got.map((x) => [x.id, x.name, x.parent]), exported.people.map((x) => [x.id, x.name, x.parent]));
    // and it can be edited further
    await p2.click('.node >> nth=0');
    await p2.click('#actionbar [data-act="child"]');
    await p2.waitForSelector('#modal:not(.hidden)');
    await p2.keyboard.type('નવો');
    await p2.keyboard.press('Enter');
    await p2.waitForSelector('#modal', { state: 'hidden' });
    assert.equal((await p2.evaluate(() => window.FTApp.store.data.people.length)), 18);
    await p2.screenshot({ path: path.join(OUT, '4-after-import-' + path.extname(f).slice(1) + '.png') });
    await ctx2.close();
  }
  ok('import JSON and CSV into a fresh browser restores everything, and editing continues');

  // ---- bad file shows a message instead of breaking
  const bad = path.join(OUT, 'bad.csv');
  fs.writeFileSync(bad, 'id,name,parent_id\n1,A,2\n2,B,1\n');
  let alertText = '';
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => { alertText = d.message(); await d.accept(); });
  await page.setInputFiles('#fileInput', bad);
  await page.waitForTimeout(400);
  assert.ok(/chakkar|cycle/i.test(alertText), 'bad file explained: ' + alertText);
  assert.equal((await names(page)).length, 17, 'data untouched');
  ok('a bad import file is rejected with a clear message');

  assert.deepEqual(errors, [], 'no JS errors: ' + errors.join(' | '));
  ok('no JavaScript errors in the browser console');

  await browser.close();
  console.log('\n' + passed + ' browser checks passed. Screenshots: ' + OUT);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
