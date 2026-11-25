/*
 * Gujlish -> Gujarati suggestions.
 *  1) Google Input Tools (online, best quality)
 *  2) Offline rule based fallback (basic, always works)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FT = root.FT || {};
  root.FT.translit = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var VIRAMA = '્';

  // independent vowel, matra (vowel sign after a consonant)
  var VOWELS = {
    aa: ['આ', 'ા'], ai: ['ઐ', 'ૈ'], au: ['ઔ', 'ૌ'],
    ee: ['ઈ', 'ી'], ii: ['ઈ', 'ી'],
    oo: ['ઊ', 'ૂ'], uu: ['ઊ', 'ૂ'],
    a: ['અ', ''], i: ['ઇ', 'િ'], u: ['ઉ', 'ુ'],
    e: ['એ', 'ે'], o: ['ઓ', 'ો'],
    A: ['આ', 'ા'], I: ['ઈ', 'ી'], U: ['ઊ', 'ૂ']
  };

  var CONS = {
    chh: 'છ', ksh: 'ક્ષ',
    kh: 'ખ', gh: 'ઘ', ch: 'ચ', jh: 'ઝ', th: 'થ', dh: 'ધ',
    Th: 'ઠ', Dh: 'ઢ', ph: 'ફ', bh: 'ભ', sh: 'શ', Sh: 'ષ',
    gn: 'જ્ઞ',
    k: 'ક', g: 'ગ', c: 'ક', j: 'જ', t: 'ત', d: 'દ', n: 'ન',
    T: 'ટ', D: 'ડ', N: 'ણ', p: 'પ', f: 'ફ', b: 'બ', m: 'મ',
    y: 'ય', r: 'ર', l: 'લ', L: 'ળ', v: 'વ', w: 'વ', s: 'સ',
    h: 'હ', z: 'ઝ', x: 'ક્ષ', q: 'ક'
  };

  var SPECIAL = { M: 'ં', H: 'ઃ' };

  function matchLongest(table, str, i, maxLen) {
    for (var len = maxLen; len >= 1; len--) {
      var part = str.substr(i, len);
      if (part.length === len && Object.prototype.hasOwnProperty.call(table, part)) {
        return { key: part, val: table[part] };
      }
    }
    return null;
  }

  // Capital letters are kept only for retroflex / special letters, and never at the word start.
  function normalizeCase(word) {
    var out = '';
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      if (i === 0) { out += ch.toLowerCase(); continue; }
      if (ch >= 'A' && ch <= 'Z' && 'TDNLSAIUMH'.indexOf(ch) === -1) ch = ch.toLowerCase();
      out += ch;
    }
    return out;
  }

  function offline(word) {
    var s = normalizeCase(String(word || ''));
    var out = '';
    var afterCons = false;
    var i = 0;
    while (i < s.length) {
      var v = matchLongest(VOWELS, s, i, 2);
      if (v) {
        out += afterCons ? v.val[1] : v.val[0];
        afterCons = false;
        i += v.key.length;
        continue;
      }
      var c = matchLongest(CONS, s, i, 3);
      if (c) {
        if (afterCons) out += VIRAMA;
        out += c.val;
        afterCons = true;
        i += c.key.length;
        continue;
      }
      var sp = SPECIAL[s.charAt(i)];
      if (sp) { out += sp; afterCons = false; i++; continue; }
      out += s.charAt(i);
      afterCons = false;
      i++;
    }
    return out;
  }

  // "bhavesh" at the end of "jivraj bhavesh" -> {head: "jivraj ", tail: "bhavesh"}
  function splitTail(value) {
    var m = /[A-Za-z]+$/.exec(value);
    if (!m) return { head: value, tail: '' };
    return { head: value.slice(0, m.index), tail: m[0] };
  }

  var cache = {};

  function googleSuggest(word, timeoutMs) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
    var url = 'https://inputtools.google.com/request?text=' + encodeURIComponent(word) +
      '&itc=gu-t-i0-und&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage';
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 2500) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (timer) clearTimeout(timer);
        if (d && d[0] === 'SUCCESS' && d[1] && d[1][0] && Array.isArray(d[1][0][1])) return d[1][0][1];
        return [];
      }, function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      });
  }

  function uniq(list) {
    var seen = {};
    return list.filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  /** Returns Promise<{items:string[], source:'google'|'offline'}> */
  function suggest(word) {
    var key = word;
    if (cache[key]) return Promise.resolve(cache[key]);
    var off = offline(word);
    return googleSuggest(word).then(function (list) {
      var res = { items: uniq(list.concat([off])).slice(0, 6), source: list.length ? 'google' : 'offline' };
      cache[key] = res;
      return res;
    }, function () {
      return { items: [off], source: 'offline' };
    });
  }

  function hasGujarati(s) { return /[઀-૿]/.test(s); }

  return { suggest: suggest, offline: offline, splitTail: splitTail, hasGujarati: hasGujarati };
});
