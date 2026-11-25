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

/* ---------- round fan layout (tree / ped view) ---------- */
function fanOverlaps(pos) {
  const a = Object.values(pos);
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (Math.abs(a[i].x - a[j].x) < (a[i].w + a[j].w) / 2 && Math.abs(a[i].y - a[j].y) < a[i].h) return true;
    }
  }
  return false;
}

// a family shaped like a real one: a trunk of 4, then 6 branches, then 3 more generations (fake names)
function familyLike() {
  const people = [];
  let n = 0;
  const add = (parent) => { const id = 'f' + n++; people.push({ id, name: 'નામ' + n, parent }); return id; };
  let top = add(null);
  for (let i = 0; i < 3; i++) top = add(top);
  const grand = [3, 2, 0, 2, 2, 4]; // children of each of the 6 sons
  grand.forEach((g) => {
    const son = add(top);
    for (let i = 0; i < g; i++) {
      const kid = add(son);
      const gk = (n + i) % 3; // 0..2 grandchildren
      for (let j = 0; j < gk; j++) {
        const gg = add(kid);
        if ((n + j) % 4 === 0) add(gg);
      }
    }
  });
  return people;
}

test('fan: trunk goes straight up, children spread around the fork', () => {
  const people = [
    { id: 'a', name: 'A', parent: null }, { id: 'b', name: 'B', parent: 'a' }, { id: 'c', name: 'C', parent: 'b' },
    { id: 'k1', name: 'K1', parent: 'c' }, { id: 'k2', name: 'K2', parent: 'c' }, { id: 'k3', name: 'K3', parent: 'c' }
  ];
  const F = layout.computeFan(people);
  assert.deepEqual(F.chain, ['a', 'b', 'c']);
  assert.equal(F.forkId, 'c');
  assert.equal(F.virtual, false);
  ['a', 'b', 'c'].forEach((id) => assert.equal(F.pos[id].x, 0));
  assert.ok(F.pos.a.y < F.pos.b.y && F.pos.b.y < F.pos.c.y, 'trunk grows upwards');
  assert.ok(F.pos.k1.x < F.pos.k2.x && F.pos.k2.x < F.pos.k3.x, 'children keep their order left to right');
  assert.ok(Math.abs(F.pos.k2.x) < 1e-6, 'middle child is straight above the fork');
  assert.ok(Math.abs(F.pos.k1.x + F.pos.k3.x) < 1e-6, 'symmetric');
  assert.ok(F.pos.k1.y > F.pos.c.y - 100, 'children are not far below the fork');
  assert.equal(fanOverlaps(F.pos), false);
});

test('fan: family-shaped tree is round (not a flat strip) and nothing overlaps', () => {
  const people = familyLike();
  assert.ok(people.length >= 35);
  const F = layout.computeFan(people);
  assert.equal(fanOverlaps(F.pos), false);
  const w = F.bbox.maxX - F.bbox.minX, h = F.bbox.maxY - F.bbox.minY;
  assert.ok(w / h < 1.9, 'width/height = ' + (w / h).toFixed(2));
  assert.ok(w / h > 0.6);
  assert.ok(F.pos[F.chain[0]].y < 200, 'oldest person is at the foot of the trunk');
  // everybody is above the ground
  Object.values(F.pos).forEach((p) => assert.ok(p.y - p.h / 2 > 60));
});

test('fan: children of one person stay inside the angle of that person', () => {
  const people = familyLike();
  const F = layout.computeFan(people);
  const kids = {};
  people.forEach((p) => { if (p.parent) (kids[p.parent] = kids[p.parent] || []).push(p.id); });
  Object.keys(kids).forEach((id) => {
    if (F.pos[id].chain || id === F.forkId) return;
    const a = F.pos[id].angle;
    kids[id].forEach((k) => assert.ok(Math.abs(F.pos[k].angle - a) < 0.9, 'child angle near parent angle'));
  });
});

test('fan: several roots get a short trunk and spread out; nothing overlaps', () => {
  const people = [];
  for (let r = 0; r < 3; r++) {
    people.push({ id: 'r' + r, name: 'રૂટ' + r, parent: null });
    for (let k = 0; k < 3; k++) {
      people.push({ id: 'r' + r + 'k' + k, name: 'બાળ' + k, parent: 'r' + r });
      people.push({ id: 'r' + r + 'k' + k + 'x', name: 'ઉપ' + k, parent: 'r' + r + 'k' + k });
    }
  }
  const F = layout.computeFan(people);
  assert.equal(F.virtual, true);
  assert.deepEqual(F.chain, []);
  assert.equal(fanOverlaps(F.pos), false);
  assert.ok(F.pos.r0.x < F.pos.r1.x && F.pos.r1.x < F.pos.r2.x);
});

test('fan: one person, one chain, and empty list all work', () => {
  assert.deepEqual(layout.computeFan([]).pos, {});
  const one = layout.computeFan([{ id: 'a', name: 'A', parent: null }]);
  assert.equal(one.pos.a.x, 0);
  assert.ok(one.pos.a.y > 0);
  const chain = layout.computeFan([
    { id: 'a', name: 'A', parent: null }, { id: 'b', name: 'B', parent: 'a' }, { id: 'c', name: 'C', parent: 'b' }
  ]);
  assert.equal(chain.forkId, 'c');
  assert.equal(fanOverlaps(chain.pos), false);
});

test('fan: random big trees never overlap', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let round = 0; round < 6; round++) {
    const people = [];
    const total = 20 + Math.floor(rnd() * 120);
    for (let i = 0; i < total; i++) {
      const parent = i === 0 || (round === 5 && i < 3) ? null : people[Math.floor(Math.pow(rnd(), 1.3) * i)].id;
      people.push({ id: 'n' + i, name: 'નામ'.repeat(1 + Math.floor(rnd() * 2)) + i, parent });
    }
    const F = layout.computeFan(people);
    assert.equal(Object.keys(F.pos).length, total);
    assert.equal(fanOverlaps(F.pos), false, 'round ' + round);
  }
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
