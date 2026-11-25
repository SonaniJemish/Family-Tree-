'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const io = require('../js/io.js');
const layout = require('../js/layout.js');
const translit = require('../js/translit.js');
const { Store } = require('../js/store.js');

function memStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

/* ---------- layout ---------- */
function overlaps(pos) {
  const byDepth = {};
  Object.values(pos).forEach((p) => { (byDepth[p.depth] = byDepth[p.depth] || []).push(p); });
  for (const d of Object.keys(byDepth)) {
    const row = byDepth[d].sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      if (row[i - 1].x + row[i - 1].w / 2 > row[i].x - row[i].w / 2 + 1e-9) return true;
    }
  }
  return false;
}

test('layout: parent is centred above its children, children in order', () => {
  const people = [
    { id: 'a', name: 'A', parent: null },
    { id: 'b', name: 'B', parent: 'a' },
    { id: 'c', name: 'C', parent: 'a' },
    { id: 'd', name: 'D', parent: 'a' }
  ];
  const L = layout.computeLayout(people);
  assert.ok(L.pos.b.x < L.pos.c.x && L.pos.c.x < L.pos.d.x);
  assert.ok(Math.abs(L.pos.a.x - L.pos.c.x) < 1e-6);
  assert.equal(L.pos.a.y, 0);
  assert.ok(L.pos.b.y > L.pos.a.y);
  assert.equal(L.maxDepth, 1);
});

test('layout: one child sits straight below the parent', () => {
  const L = layout.computeLayout([
    { id: 'a', name: 'A', parent: null },
    { id: 'b', name: 'B', parent: 'a' }
  ]);
  assert.ok(Math.abs(L.pos.a.x - L.pos.b.x) < 1e-6);
});

test('layout: no overlaps for a big uneven tree and several roots', () => {
  const people = [];
  let n = 0;
  function add(parent, depth) {
    const id = 'n' + n++;
    people.push({ id, name: 'નામ' + 'ા'.repeat(n % 5) + n, parent });
    if (depth < 5) {
      const kids = (n * 7) % 4; // 0..3 children, uneven
      for (let i = 0; i < kids; i++) add(id, depth + 1);
    }
  }
  add(null, 0); add(null, 0); add(null, 0);
  assert.ok(people.length > 20);
  const L = layout.computeLayout(people);
  assert.equal(L.rootIds.length, 3);
  assert.equal(overlaps(L.pos), false);
  Object.values(L.pos).forEach((p) => assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('layout: empty list is fine', () => {
  const L = layout.computeLayout([]);
  assert.deepEqual(L.pos, {});
});

test('layout: descendant counts', () => {
  const L = layout.computeLayout([
    { id: 'a', name: 'A', parent: null },
    { id: 'b', name: 'B', parent: 'a' },
    { id: 'c', name: 'C', parent: 'b' }
  ]);
  assert.equal(L.pos.a.desc, 2);
  assert.equal(L.pos.c.desc, 0);
});

/* ---------- io ---------- */
const sample = [
  { id: 'p1', name: 'જીવરાજભાઈ', parent: null },
  { id: 'p2', name: 'અક્ષય, "મોટો"', parent: 'p1' },
  { id: 'p3', name: 'મનન\nનવી લાઇન', parent: 'p1' },
  { id: 'p4', name: 'યશ', parent: 'p2' }
];

test('io: JSON round trip keeps Gujarati and order', () => {
  const data = { title: 'ટાઇટલ', people: sample };
  const res = io.parseJSON(io.toJSON(data));
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.people, sample);
  assert.equal(res.data.title, 'ટાઇટલ');
  assert.equal(res.data.nextId, 5);
});

test('io: CSV round trip with commas, quotes, newlines and BOM', () => {
  const csv = io.toCSV({ people: sample });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const res = io.parseCSV(csv);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.people, sample);
});

test('io: CSV with different column order and Windows line ends', () => {
  const res = io.parseCSV('name,parent,id\r\nરાજ,,x1\r\nનીલ,x1,x2\r\n');
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.people, [
    { id: 'x1', name: 'રાજ', parent: null },
    { id: 'x2', name: 'નીલ', parent: 'x1' }
  ]);
});

test('io: errors for bad files', () => {
  assert.equal(io.parseJSON('{not json').ok, false);
  assert.equal(io.parseCSV('').ok, false);
  assert.equal(io.parseCSV('a,b\n1,2').ok, false);
  const dup = io.normalize([{ id: '1', name: 'a' }, { id: '1', name: 'b' }]);
  assert.equal(dup.ok, false);
  const missing = io.normalize([{ id: '1', name: 'a', parent: '9' }]);
  assert.equal(missing.ok, false);
  const noName = io.normalize([{ id: '1', name: '  ' }]);
  assert.equal(noName.ok, false);
  const cycle = io.normalize([{ id: '1', name: 'a', parent: '2' }, { id: '2', name: 'b', parent: '1' }]);
  assert.equal(cycle.ok, false);
  const self = io.normalize([{ id: '1', name: 'a', parent: '1' }]);
  assert.equal(self.ok, false);
});

test('io: parseAny picks the right parser', () => {
  assert.equal(io.parseAny(io.toJSON({ title: 't', people: sample }), 'x.json').ok, true);
  assert.equal(io.parseAny(io.toCSV({ people: sample }), 'x.csv').ok, true);
  assert.equal(io.parseAny(io.toCSV({ people: sample }), 'noext').ok, true);
});

/* ---------- store ---------- */
test('store: add child, sibling order, rename, undo/redo, persistence', () => {
  const storage = memStorage();
  const s = new Store(storage);
  const a = s.addRoot('અ');
  const b = s.addChild(a, 'બ');
  const d = s.addChild(a, 'ડ');
  const c = s.addSibling(b, 'ક'); // should land between b and d
  assert.deepEqual(s.childrenOf(a).map((p) => p.name), ['બ', 'ક', 'ડ']);
  s.rename(c, 'કક');
  assert.equal(s.get(c).name, 'કક');

  const s2 = new Store(storage);
  assert.equal(s2.load(), true);
  assert.deepEqual(s2.data.people.map((p) => p.name), ['અ', 'બ', 'કક', 'ડ']);

  assert.equal(s.undo(), true); // undo rename
  assert.equal(s.get(c).name, 'ક');
  assert.equal(s.redo(), true);
  assert.equal(s.get(c).name, 'કક');
  assert.ok(d);
});

test('store: sibling of a root is a new root; ids never repeat', () => {
  const s = new Store(null);
  const a = s.addRoot('A');
  const b = s.addSibling(a, 'B');
  assert.equal(s.get(b).parent, null);
  const ids = new Set(s.data.people.map((p) => p.id));
  assert.equal(ids.size, 2);
  s.remove(b);
  const c = s.addRoot('C');
  assert.equal(new Set(s.data.people.map((p) => p.id)).size, 2);
  assert.ok(c);
});

test('store: remove deletes the whole branch', () => {
  const s = new Store(null);
  const a = s.addRoot('A');
  const b = s.addChild(a, 'B');
  s.addChild(b, 'C');
  s.addChild(b, 'D');
  const e = s.addChild(a, 'E');
  assert.equal(s.countDescendants(a), 4);
  assert.equal(s.remove(b), 3);
  assert.deepEqual(s.data.people.map((p) => p.name), ['A', 'E']);
  assert.equal(s.undo(), true);
  assert.equal(s.data.people.length, 5);
  assert.ok(e);
});

test('store: replaceAll is undoable', () => {
  const s = new Store(null);
  s.addRoot('A');
  const res = io.normalize([{ id: 'z', name: 'Z', parent: null }], 'T');
  s.replaceAll(res.data);
  assert.deepEqual(s.data.people.map((p) => p.name), ['Z']);
  s.undo();
  assert.deepEqual(s.data.people.map((p) => p.name), ['A']);
});

/* ---------- translit ---------- */
test('translit: splitTail', () => {
  assert.deepEqual(translit.splitTail('jemish'), { head: '', tail: 'jemish' });
  assert.deepEqual(translit.splitTail('રાજ bhai'), { head: 'રાજ ', tail: 'bhai' });
  assert.deepEqual(translit.splitTail('રાજ'), { head: 'રાજ', tail: '' });
});

test('translit: offline fallback gives sensible Gujarati', () => {
  assert.equal(translit.offline('jemish'), 'જેમિશ');
  assert.equal(translit.offline('Akshay'), 'અક્ષય');
  assert.equal(translit.offline('maan'), 'માન');
  assert.equal(translit.offline('yash'), 'યશ');
  assert.equal(translit.offline('bhaaveshabhaaee'), 'ભાવેશભાઈ');
  assert.ok(translit.hasGujarati(translit.offline('raj')));
  // every character produced must be inside the Gujarati block
  ['jemish', 'Akshay', 'Dipak', 'Hardik', 'chhaya', 'gnaan', 'Mahesh', 'Kirti'].forEach((w) => {
    assert.ok(/^[઀-૿]+$/.test(translit.offline(w)), w);
  });
  assert.equal(translit.offline('raj'), 'રજ');
  assert.equal(translit.offline('raaj'), 'રાજ');
  assert.equal(translit.offline('Dipak'), 'દિપક');
});
