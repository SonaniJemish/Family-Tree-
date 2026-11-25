/*
 * Data format, validation, JSON + CSV import/export.
 *
 * data = { version: 1, title: "...", nextId: 12, people: [ {id:"p1", name:"જીવરાજભાઈ", parent:null}, ... ] }
 * Order of people in the array = order of siblings (left to right).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FT = root.FT || {};
  root.FT.io = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var DEFAULT_TITLE = 'Vanshaa Vali';

  function emptyData() {
    return { version: 1, title: DEFAULT_TITLE, nextId: 1, people: [] };
  }

  function fail(error) { return { ok: false, error: error }; }

  /** Validate raw people list and return clean data. rawPeople: [{id,name,parent}] */
  function normalize(rawPeople, title) {
    if (!Array.isArray(rawPeople)) return fail('File me "people" ki list nahi mili.');
    var people = [];
    var ids = {};
    for (var i = 0; i < rawPeople.length; i++) {
      var r = rawPeople[i] || {};
      var id = r.id === undefined || r.id === null ? '' : String(r.id).trim();
      var name = r.name === undefined || r.name === null ? '' : String(r.name).trim();
      var parent = r.parent === undefined || r.parent === null || String(r.parent).trim() === '' ? null : String(r.parent).trim();
      var rowNo = i + 1;
      if (!id) return fail('Row ' + rowNo + ': id khali hai.');
      if (!name) return fail('Row ' + rowNo + ': naam khali hai.');
      if (ids[id]) return fail('Row ' + rowNo + ': id "' + id + '" do baar aaya hai.');
      ids[id] = true;
      people.push({ id: id, name: name, parent: parent });
    }
    for (var j = 0; j < people.length; j++) {
      var p = people[j];
      if (p.parent !== null && !ids[p.parent]) {
        return fail('Row ' + (j + 1) + ': parent id "' + p.parent + '" file me nahi hai.');
      }
      if (p.parent === p.id) return fail('Row ' + (j + 1) + ': koi apna khud ka parent nahi ho sakta.');
    }
    // cycle check
    var byId = {};
    people.forEach(function (x) { byId[x.id] = x; });
    var state = {}; // 1 = visiting, 2 = done
    for (var k = 0; k < people.length; k++) {
      var chain = [];
      var cur = people[k];
      while (cur && state[cur.id] !== 2) {
        if (state[cur.id] === 1) return fail('Parent-child me chakkar (cycle) mila: "' + cur.name + '" ke aas-paas.');
        state[cur.id] = 1;
        chain.push(cur);
        cur = cur.parent ? byId[cur.parent] : null;
      }
      chain.forEach(function (c) { state[c.id] = 2; });
    }
    var maxNum = 0;
    people.forEach(function (x) {
      var m = /^p(\d+)$/.exec(x.id);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    return {
      ok: true,
      data: {
        version: 1,
        title: title && String(title).trim() ? String(title).trim() : DEFAULT_TITLE,
        nextId: maxNum + 1,
        people: people
      }
    };
  }

  // ---------- JSON ----------
  function toJSON(data) {
    return JSON.stringify({ version: 1, title: data.title, people: data.people }, null, 2);
  }

  function parseJSON(text) {
    var obj;
    try { obj = JSON.parse(String(text).replace(/^﻿/, '')); }
    catch (e) { return fail('JSON file sahi nahi hai (padh nahi paya).'); }
    if (Array.isArray(obj)) return normalize(obj, null);
    if (!obj || typeof obj !== 'object') return fail('JSON file sahi nahi hai.');
    return normalize(obj.people, obj.title);
  }

  // ---------- CSV ----------
  function csvEscape(v) {
    var s = String(v === null || v === undefined ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** CSV with BOM so Excel shows Gujarati correctly. Columns: id,name,parent_id */
  function toCSV(data) {
    var lines = ['id,name,parent_id'];
    data.people.forEach(function (p) {
      lines.push([csvEscape(p.id), csvEscape(p.name), csvEscape(p.parent || '')].join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function parseCSVRows(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var s = String(text).replace(/^﻿/, '');
    while (i < s.length) {
      var ch = s.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (s.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
  }

  function parseCSV(text) {
    var rows = parseCSVRows(text);
    if (!rows.length) return fail('CSV file khali hai.');
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var iId = header.indexOf('id');
    var iName = header.indexOf('name');
    var iParent = header.indexOf('parent_id');
    if (iParent === -1) iParent = header.indexOf('parent');
    if (iId === -1 || iName === -1 || iParent === -1) {
      return fail('CSV ki pehli line me id, name, parent_id columns hone chahiye.');
    }
    var raw = rows.slice(1).map(function (r) {
      return { id: r[iId], name: r[iName], parent: r[iParent] };
    });
    return normalize(raw, null);
  }

  /** Detect JSON or CSV from file name / content. */
  function parseAny(text, fileName) {
    var t = String(text).replace(/^﻿/, '').trim();
    var name = String(fileName || '').toLowerCase();
    var isJson = name.slice(-5) === '.json' || t.charAt(0) === '{' || t.charAt(0) === '[';
    var res = isJson ? parseJSON(t) : parseCSV(t);
    if (res.ok) res.format = isJson ? 'json' : 'csv';
    return res;
  }

  return {
    DEFAULT_TITLE: DEFAULT_TITLE,
    emptyData: emptyData,
    normalize: normalize,
    toJSON: toJSON,
    parseJSON: parseJSON,
    toCSV: toCSV,
    parseCSV: parseCSV,
    parseAny: parseAny
  };
});
