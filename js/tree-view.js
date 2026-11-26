/*
 * "Ped" view: the same family data drawn as a real, round, leafy tree.
 *
 *  - a thick trunk with bark, a flared foot and roots (the oldest people sit on the trunk)
 *  - from the first fork the family spreads like a round crown (see layout.computeFan)
 *  - every branch is a tapered limb: thick at the parent, thin at the child, with twigs
 *  - the crown is made of shaded leaf clusters (light from the sun at the top right),
 *    drawn BEHIND the branches so every parent-child connection stays visible
 *  - sun rays, hills, far trees, grass, flowers, rocks and fallen leaves
 *
 * Everything is generated from the data, so it re-grows by itself.
 * Later this default drawing can be swapped for your own illustration / Figma design.
 */
(function (root, factory) {
  var api = factory();
  root.FT = root.FT || {};
  root.FT.TreeView = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var FT = (typeof self !== 'undefined' ? self : globalThis).FT;
  var FONT_ATTR = 'Noto Sans Gujarati, Nirmala UI, Shruti, Lohit Gujarati, Segoe UI, sans-serif';
  var LEAF_COLORS = ['#2f6b2c', '#3f7a34', '#4f8f3a', '#62a043', '#78b34a', '#93c250', '#b3d05a'];
  var FALLEN = ['#c9a43a', '#b5782d', '#8f6b2a', '#7aa23f', '#d4b24c'];
  var FLOWERS = ['#f48fb1', '#ffd54f', '#ffffff', '#ce93d8', '#ff8a65'];
  var LIGHT = { x: 0.6, y: -0.8 };          // sun is at the top right

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function bez(p0, c1, c2, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
    };
  }

  /**
   * A filled ribbon along a centre line with a width at every point.
   * hi = 0: normal ribbon. hi > 0: the centre line is moved towards the sun (used for highlights).
   */
  function ribbon(pts, ws, hi) {
    var L = [], R = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var cx = pts[i].x, cy = pts[i].y;
      if (hi) {
        var sgn = (nx * LIGHT.x + ny * LIGHT.y) >= 0 ? 1 : -1;
        cx += nx * sgn * ws[i] * hi;
        cy += ny * sgn * ws[i] * hi;
      }
      var hw = ws[i] / 2;
      L.push(r1(cx + nx * hw) + ' ' + r1(cy + ny * hw));
      R.push(r1(cx - nx * hw) + ' ' + r1(cy - ny * hw));
    }
    return 'M' + L.join('L') + 'L' + R.reverse().join('L') + 'Z';
  }

  function leafUse(x, y, rot, sc, fill) {
    var id = '#ft-lf' + (sc > 1.05 ? 1 : 2);
    return '<use href="' + id + '" xlink:href="' + id + '" transform="translate(' + r1(x) + ' ' + r1(y) +
      ') rotate(' + Math.round(rot) + ') scale(' + r1(sc) + ')" fill="' + fill + '"/>';
  }

  function cloud(cx, cy, s) {
    return '<g fill="#fff" opacity="0.82">' +
      '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(78 * s) + '" ry="' + r1(24 * s) + '"/>' +
      '<ellipse cx="' + r1(cx + 46 * s) + '" cy="' + r1(cy - 15 * s) + '" rx="' + r1(50 * s) + '" ry="' + r1(29 * s) + '"/>' +
      '<ellipse cx="' + r1(cx - 44 * s) + '" cy="' + r1(cy - 9 * s) + '" rx="' + r1(42 * s) + '" ry="' + r1(23 * s) + '"/></g>';
  }

  /** A small far-away tree for the hills. */
  function farTree(x, y, h, rnd) {
    var tw = h * 0.09;
    var g = '<rect x="' + r1(x - tw / 2) + '" y="' + r1(y - h * 0.42) + '" width="' + r1(tw) + '" height="' + r1(h * 0.42) + '" fill="#6b5a45"/>';
    var cols = ['#6fa05a', '#7dae63', '#5f9250'];
    for (var i = 0; i < 4; i++) {
      var cx = x + (rnd() - 0.5) * h * 0.34, cy = y - h * (0.55 + rnd() * 0.3), rr = h * (0.2 + rnd() * 0.12);
      g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(rr) + '" fill="' + cols[i % 3] + '"/>';
    }
    return g;
  }

  /** Returns { svg, width, height } for a data object { title, people }. */
  function build(data) {
    var people = data.people || [];
    var n = people.length;
    var has = n > 0;
    var TAGH = 46;
    var measure = FT.layout.makeMeasure('700 26px ' + FT.layout.FONT, 42, 96, 480);
    var F = FT.layout.computeFan(people, { measure: measure, nodeH: TAGH });

    var bb = has ? F.bbox : { minX: -260, maxX: 260, minY: 100, maxY: 420 };
    var padX = 210, padTop = 330, padBot = 210;
    var half = Math.max(Math.abs(bb.minX), Math.abs(bb.maxX));
    var W = Math.max(1300, Math.ceil(half * 2 + padX * 2));
    var ox = W / 2;
    var Yg = padTop + bb.maxY;      // ground line in picture coordinates
    var H = Math.ceil(Yg + padBot);
    function SX(x) { return ox + x; }
    function SY(y) { return Yg - y; }

    var scene = rng(hash('scene'));
    var trunkW = Math.max(150, Math.min(330, 12 + 22 * Math.sqrt(n)));
    var C = has ? { x: SX(F.center.x), y: SY(F.center.y) } : null;

    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT_ATTR + '">');

    /* ---------- definitions ---------- */
    out.push('<defs>' +
      '<linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9d8ec"/><stop offset="0.55" stop-color="#e3f3ec"/><stop offset="1" stop-color="#f6f9e6"/></linearGradient>' +
      '<radialGradient id="ft-sun"><stop offset="0" stop-color="#fff7c4" stop-opacity="0.95"/><stop offset="1" stop-color="#fff7c4" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="ft-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc26b"/><stop offset="1" stop-color="#5a9446"/></linearGradient>' +
      '<linearGradient id="ft-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2614"/><stop offset="0.22" stop-color="#65401f"/>' +
      '<stop offset="0.52" stop-color="#9d6c3a"/><stop offset="0.7" stop-color="#85592b"/><stop offset="1" stop-color="#3f2a16"/></linearGradient>' +
      // shaded leaf clusters: light spot at the upper right, dark at the lower left
      '<radialGradient id="ft-bd" cx="0.62" cy="0.34" r="0.78"><stop offset="0" stop-color="#3f8a37"/><stop offset="0.6" stop-color="#2d6a2c"/><stop offset="1" stop-color="#1c4a20"/></radialGradient>' +
      '<radialGradient id="ft-bm" cx="0.62" cy="0.32" r="0.75"><stop offset="0" stop-color="#7cbd52"/><stop offset="0.6" stop-color="#4f9a3d"/><stop offset="1" stop-color="#33782f"/></radialGradient>' +
      '<radialGradient id="ft-bl" cx="0.6" cy="0.35" r="0.7"><stop offset="0" stop-color="#c3e06a"/><stop offset="0.65" stop-color="#8cc552"/><stop offset="1" stop-color="#5fa844" stop-opacity="0.6"/></radialGradient>' +
      '<radialGradient id="ft-rock" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#c9ccd0"/><stop offset="1" stop-color="#6d737b"/></radialGradient>' +
      '<g id="ft-lf1"><path d="M0 0C5 -10 20 -11 32 0C20 11 5 10 0 0Z"/><path d="M2 0L27 0" fill="none" stroke="#2f5a25" stroke-width="0.9" stroke-opacity="0.7"/></g>' +
      '<g id="ft-lf2"><path d="M0 0C3 -13 22 -14 28 0C22 14 3 13 0 0Z"/><path d="M2 0L23 0" fill="none" stroke="#2f5a25" stroke-width="0.9" stroke-opacity="0.7"/></g>' +
      '</defs>');

    /* ---------- sky, sun, rays, clouds, birds ---------- */
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#ft-sky)"/>');
    var sunX = W * 0.86, sunY = 190;
    out.push('<circle cx="' + r1(sunX) + '" cy="' + sunY + '" r="210" fill="url(#ft-sun)"/><circle cx="' + r1(sunX) + '" cy="' + sunY + '" r="56" fill="#fff4b4"/>');
    var rays = '';
    for (var rI = 0; rI < 6; rI++) {
      var ra0 = 2.25 + rI * 0.19, ra1 = ra0 + 0.07, RL = Math.max(W, H) * 1.1;
      rays += 'M' + r1(sunX) + ' ' + sunY + 'L' + r1(sunX + Math.cos(ra0) * RL) + ' ' + r1(sunY + Math.sin(ra0) * RL) +
        'L' + r1(sunX + Math.cos(ra1) * RL) + ' ' + r1(sunY + Math.sin(ra1) * RL) + 'Z';
    }
    out.push('<path d="' + rays + '" fill="#fffbe0" opacity="0.14"/>');
    out.push(cloud(W * 0.13, 210, 1.15), cloud(W * 0.30, 118, 0.8), cloud(W * 0.70, 250, 0.95), cloud(W * 0.93, 110, 0.7));
    var birds = '';
    for (var bI = 0; bI < 4; bI++) {
      var bx = W * (0.62 + scene() * 0.28), by = 120 + scene() * 150;
      birds += 'M' + r1(bx) + ' ' + r1(by) + 'q9 -10 18 0q9 -10 18 0';
    }
    out.push('<path d="' + birds + '" fill="none" stroke="#4b5563" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>');

    /* ---------- far mountains, hills and far trees ---------- */
    var mt = 'M0 ' + (Yg - 60);
    var peaks = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1];
    peaks.forEach(function (p, i) { mt += 'L' + r1(W * p) + ' ' + r1(Yg - (i % 2 ? 110 : 250) - scene() * 40); });
    mt += 'V' + H + 'H0Z';
    out.push('<path d="' + mt + '" fill="#a9c6d2" opacity="0.55"/>');
    out.push('<path d="M0 ' + (Yg - 50) + 'C' + (W * 0.2) + ' ' + (Yg - 200) + ' ' + (W * 0.38) + ' ' + (Yg - 70) + ' ' + (W * 0.55) + ' ' + (Yg - 130) +
      'S' + (W * 0.88) + ' ' + (Yg - 210) + ' ' + W + ' ' + (Yg - 80) + 'V' + H + 'H0Z" fill="#b6d9a4" opacity="0.8"/>');
    out.push('<path d="M0 ' + (Yg - 20) + 'C' + (W * 0.15) + ' ' + (Yg - 100) + ' ' + (W * 0.35) + ' ' + (Yg - 30) + ' ' + (W * 0.5) + ' ' + (Yg - 62) +
      'S' + (W * 0.85) + ' ' + (Yg - 110) + ' ' + W + ' ' + (Yg - 30) + 'V' + H + 'H0Z" fill="#9dcb83" opacity="0.9"/>');
    var farCount = Math.min(26, Math.round(W / 130));
    var farG = '<g opacity="0.85">';
    for (var fT = 0; fT < farCount; fT++) {
      var ftx = scene() * W, fth = 60 + scene() * 70;
      var fty = Yg - 22 - scene() * 28;
      farG += farTree(ftx, fty, fth, scene);
    }
    out.push(farG + '</g>');
    // near hill (the ground the tree stands on)
    out.push('<path d="M0 ' + (Yg + 10) + 'C' + (W * 0.25) + ' ' + (Yg - 56) + ' ' + (W * 0.75) + ' ' + (Yg - 56) + ' ' + W + ' ' + (Yg + 10) +
      'V' + H + 'H0Z" fill="url(#ft-hill)"/>');
    // soft shadow under the crown (a little to the left, the sun is on the right)
    var shadowRx = Math.min(half * 0.95, 900);
    out.push('<ellipse cx="' + r1(ox - shadowRx * 0.06) + '" cy="' + r1(Yg + 26) + '" rx="' + r1(shadowRx) + '" ry="34" fill="#2f5d27" opacity="0.2"/>');
    out.push('<ellipse cx="' + r1(ox - shadowRx * 0.04) + '" cy="' + r1(Yg + 26) + '" rx="' + r1(shadowRx * 0.6) + '" ry="22" fill="#24491f" opacity="0.22"/>');

    /* ---------- the tree ---------- */
    var P = {};
    var tags = [];
    people.forEach(function (p) {
      var q = F.pos[p.id];
      P[p.id] = { x: SX(q.x), y: SY(q.y), a: q.angle, chain: q.chain, desc: q.desc, parent: q.parent, w: q.w };
    });

    var branchDark = [], branchMid = [], branchHi = [], branchBark = [], twigs = [];
    var tipLeaves = [];                     // leaf bunches at the end of twigs: {x, y, n, seed}
    var anchors = [];                       // places where foliage grows: {x, y, r, leaves}
    var nodeLeaves = Math.max(8, Math.min(46, Math.round(46 - n * 0.12)));
    var maxMid = n > 600 ? 0 : (n > 150 ? 2 : 6);
    var twigAlong = n > 500 ? 0 : (n > 200 ? 1 : 2);
    var twigTip = n > 500 ? 1 : 3;
    var subBlobs = n > 400 ? 0 : (n > 150 ? 1 : 3);
    var forkW0 = 0;                         // total thickness of the limbs that leave the trunk top

    function branchWidth(desc) { return Math.min(trunkW * 0.6, 8 + 11 * Math.sqrt(desc)); }

    if (has) {
      people.forEach(function (p) {
        var q = P[p.id];
        if (q.chain) return;
        var rnd = rng(hash(p.id));

        var par = q.parent && P[q.parent] ? P[q.parent] : C;
        var parentIsFan = q.parent && P[q.parent] && !P[q.parent].chain;
        var uP = parentIsFan ? { x: Math.sin(par.a), y: -Math.cos(par.a) } : { x: 0, y: -1 };
        var uQ = { x: Math.sin(q.a), y: -Math.cos(q.a) };
        var d = Math.sqrt((q.x - par.x) * (q.x - par.x) + (q.y - par.y) * (q.y - par.y));
        var k = d * 0.42;
        var p0 = { x: par.x, y: par.y + (parentIsFan ? 0 : 36) };   // limbs from the trunk start inside it
        var c1 = { x: par.x + uP.x * k, y: par.y + uP.y * k };
        var c2 = { x: q.x - uQ.x * k, y: q.y - uQ.y * k };
        var p3 = { x: q.x, y: q.y };

        // tapered limb: thick where it leaves the parent, thinner towards the child
        var bw = branchWidth(q.desc);
        var w0 = parentIsFan ? bw * 1.1 : Math.min(trunkW * 0.62, bw * 1.25);
        var w1 = Math.max(4, bw * 0.55);
        if (!parentIsFan) forkW0 += w0;
        var N = clamp(Math.ceil(d / 16), 8, 30);
        var pts = [], ws = [], wsMid = [], wsHi = [];
        for (var i = 0; i <= N; i++) {
          var t = i / N;
          pts.push(bez(p0, c1, c2, p3, t));
          var wi = lerp(w0, w1, Math.pow(t, 0.8));
          ws.push(wi + 5);
          wsMid.push(wi);
          wsHi.push(Math.max(1.4, wi * 0.2));
        }
        branchDark.push(ribbon(pts, ws));
        branchMid.push(ribbon(pts, wsMid));
        branchHi.push(ribbon(pts, wsHi, 0.22));
        if (bw >= 22) {
          // rough bark lines along thick limbs
          var bk = '';
          for (var bl = 0; bl < 3; bl++) {
            var u = (bl - 1) * 0.28;
            bk += 'M';
            for (var bi = 0; bi <= N; bi += 1) {
              var a = pts[Math.max(0, bi - 1)], b = pts[Math.min(N, bi + 1)];
              var dx = b.x - a.x, dy = b.y - a.y, ln = Math.sqrt(dx * dx + dy * dy) || 1;
              var off = u * wsMid[bi];
              bk += (bi ? 'L' : '') + r1(pts[bi].x - dy / ln * off) + ' ' + r1(pts[bi].y + dx / ln * off);
            }
          }
          branchBark.push(bk);
        }

        // twigs with small leaf bunches
        var twig = function (sx, sy, ang, len) {
          var ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
          var cx = sx + Math.cos(ang + 0.5) * len * 0.55, cy = sy + Math.sin(ang + 0.5) * len * 0.55;
          twigs.push('M' + r1(sx) + ' ' + r1(sy) + 'Q' + r1(cx) + ' ' + r1(cy) + ' ' + r1(ex) + ' ' + r1(ey));
          tipLeaves.push({ x: ex, y: ey, n: 7, seed: hash(p.id + ':' + twigs.length) });
        };
        var tn = pts[N], tp = pts[N - 1];
        var tAng = Math.atan2(tn.y - tp.y, tn.x - tp.x);
        if (q.desc === 0) {
          for (var tt = 0; tt < twigTip; tt++) {
            var da = (tt - (twigTip - 1) / 2) * 0.9 + (rnd() - 0.5) * 0.4;
            twig(tn.x, tn.y, tAng + da, 38 + rnd() * 34);
          }
        }
        for (var ta = 0; ta < twigAlong; ta++) {
          var ti = Math.floor(N * (0.45 + rnd() * 0.45));
          var tpnt = pts[ti], tprev = pts[Math.max(0, ti - 1)];
          var base = Math.atan2(tpnt.y - tprev.y, tpnt.x - tprev.x);
          twig(tpnt.x, tpnt.y, base + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.6), 34 + rnd() * 40);
        }

        // foliage along the branch and at its end
        var steps = Math.min(maxMid, Math.floor(d / 150));
        for (var s = 1; s <= steps; s++) {
          var pt = bez(p0, c1, c2, p3, s / (steps + 1));
          anchors.push({ x: pt.x, y: pt.y, r: 62 + rnd() * 34, leaves: Math.round(nodeLeaves * 0.5) });
        }
        anchors.push({ x: q.x, y: q.y, r: 88 + rnd() * 40, leaves: nodeLeaves });
      });

      /* ---- shaded leaf clusters: dark base, mid tone, bright top (all BEHIND the limbs) ---- */
      var bd = '', bm = '', bl2 = '';
      anchors.forEach(function (a, i) {
        var ra = rng(hash('b' + i));
        var blobs = [{ x: a.x, y: a.y, r: a.r }];
        for (var sb = 0; sb < subBlobs; sb++) {
          var an = ra() * Math.PI * 2;
          blobs.push({ x: a.x + Math.cos(an) * a.r * 0.72, y: a.y + Math.sin(an) * a.r * 0.6, r: a.r * (0.42 + ra() * 0.28) });
        }
        blobs.forEach(function (bo) {
          bd += '<circle cx="' + r1(bo.x) + '" cy="' + r1(bo.y) + '" r="' + r1(bo.r * 1.08) + '"/>';
          bm += '<circle cx="' + r1(bo.x + bo.r * 0.1) + '" cy="' + r1(bo.y - bo.r * 0.12) + '" r="' + r1(bo.r * 0.8) + '"/>';
          bl2 += '<circle cx="' + r1(bo.x + bo.r * 0.24) + '" cy="' + r1(bo.y - bo.r * 0.3) + '" r="' + r1(bo.r * 0.46) + '"/>';
        });
      });
      out.push('<g fill="url(#ft-bd)">' + bd + '</g>');
      out.push('<g fill="url(#ft-bm)" opacity="0.92">' + bm + '</g>');
      out.push('<g fill="url(#ft-bl)" opacity="0.8">' + bl2 + '</g>');

      /* ---- single leaves on top of the clusters ---- */
      var leaves = [];
      anchors.forEach(function (a, i) {
        var rl = rng(hash('l' + i));
        for (var j = 0; j < a.leaves; j++) {
          var ang = rl() * Math.PI * 2;
          var rad = Math.sqrt(rl()) * a.r * 1.1;
          var lx = a.x + Math.cos(ang) * rad * 1.25;
          var ly = a.y + Math.sin(ang) * rad * 0.95 - 4;
          var lit = (Math.cos(ang) - Math.sin(ang)) / 2;            // + = towards the sun
          var ci = clamp(Math.floor((0.5 + lit * 0.42 + (rl() - 0.5) * 0.55) * LEAF_COLORS.length), 0, LEAF_COLORS.length - 1);
          leaves.push(leafUse(lx, ly, rl() * 360, 0.75 + rl() * 0.85, LEAF_COLORS[ci]));
        }
      });
      out.push('<g stroke="#2f5a25" stroke-width="0.7" stroke-opacity="0.7">' + leaves.join('') + '</g>');

      /* ---- trunk: flared foot, slight sway, tapering up to the fork ---- */
      var wb = trunkW, fl = trunkW * 0.34;
      var wt = clamp(forkW0 * 0.8, trunkW * 0.42, trunkW * 0.78);   // the trunk top is as thick as the limbs it carries
      var yb = Yg + 24, yt = C.y + 6;
      var rb = rng(hash('bark'));
      var SM = 26;
      var tl = [], tr = [], cen = [];
      var sway = function (t) { return Math.sin(t * 3.2 + 0.6) * wb * 0.03; };
      var halfW = function (t) { return lerp(wb / 2, wt / 2, Math.pow(t, 0.85)) + fl * Math.exp(-t * 11); };
      for (var si = 0; si <= SM; si++) {
        var tt2 = si / SM;
        var yy = lerp(yb, yt, tt2);
        var hw = halfW(tt2) + (rb() - 0.5) * wb * 0.012;
        var cx2 = ox + sway(tt2);
        tl.push(r1(cx2 - hw) + ' ' + r1(yy));
        tr.push(r1(cx2 + hw) + ' ' + r1(yy));
        cen.push({ x: cx2, y: yy, hw: hw });
      }
      var topCapY = yt - wt * 0.4;
      var trunkD = 'M' + tl.join('L') + 'Q' + r1(ox + sway(1)) + ' ' + r1(topCapY) + ' ' + tr[SM] + 'L' + tr.slice().reverse().join('L') + 'Z';

      var trunk = [];
      // roots first, the trunk covers their start
      var rootPaths = '', rootDark = '';
      [-1, 1].forEach(function (sd) {
        for (var ri = 0; ri < 3; ri++) {
          var rr = rng(hash('root' + sd + ri));
          var sx0 = ox + sd * (halfW(0.03) * (0.7 + ri * 0.12));
          var sy0 = yb - 40 - ri * 12;
          var len = wb * (0.34 + rr() * 0.3) + ri * 26;
          var ex0 = ox + sd * (halfW(0) + len);
          var ey0 = yb + 6 + rr() * 16;
          var rp0 = { x: sx0, y: sy0 }, rc1 = { x: sx0 + sd * len * 0.2, y: yb - 6 }, rc2 = { x: ex0 - sd * len * 0.4, y: ey0 - 4 }, rp1 = { x: ex0, y: ey0 };
          var rpts = [], rws = [], rws2 = [];
          for (var rk = 0; rk <= 10; rk++) {
            rpts.push(bez(rp0, rc1, rc2, rp1, rk / 10));
            var rw = lerp(30 - ri * 4, 4, Math.pow(rk / 10, 0.7));
            rws.push(rw + 5);
            rws2.push(rw);
          }
          rootDark += ribbon(rpts, rws);
          rootPaths += ribbon(rpts, rws2);
        }
      });
      trunk.push('<path d="' + rootDark + '" fill="#2e1b0b"/>');
      trunk.push('<path d="' + rootPaths + '" fill="#6d4724"/>');

      trunk.push('<path d="' + trunkD + '" fill="url(#ft-trunk)" stroke="#2e1b0b" stroke-width="3.5" stroke-linejoin="round"/>');
      // lit band on the sun side, shadow band on the other side
      var litD = '', shade = '';
      for (var li = 0; li <= SM; li++) litD += (li ? 'L' : 'M') + r1(cen[li].x + cen[li].hw * 0.28) + ' ' + r1(cen[li].y);
      for (var lj = SM; lj >= 0; lj--) litD += 'L' + r1(cen[lj].x + cen[lj].hw * 0.62) + ' ' + r1(cen[lj].y);
      for (var si2 = 0; si2 <= SM; si2++) shade += (si2 ? 'L' : 'M') + r1(cen[si2].x - cen[si2].hw * 1.0) + ' ' + r1(cen[si2].y);
      for (var sj = SM; sj >= 0; sj--) shade += 'L' + r1(cen[sj].x - cen[sj].hw * 0.55) + ' ' + r1(cen[sj].y);
      trunk.push('<path d="' + litD + 'Z" fill="#d9ab6d" opacity="0.2"/>');
      trunk.push('<path d="' + shade + 'Z" fill="#1d1005" opacity="0.28"/>');
      // bark: long wavy grooves that follow the trunk, plus short cracks
      var grooves = '';
      for (var g = 0; g < 14; g++) {
        var gu = (rb() - 0.5) * 1.7;
        var from = Math.floor(rb() * SM * 0.5), to = Math.min(SM, from + 6 + Math.floor(rb() * 12));
        grooves += 'M';
        for (var gi = from; gi <= to; gi++) {
          var wob = Math.sin(gi * 1.3 + g) * 3;
          grooves += (gi > from ? 'L' : '') + r1(cen[gi].x + gu * cen[gi].hw + wob) + ' ' + r1(cen[gi].y);
        }
      }
      trunk.push('<path d="' + grooves + '" fill="none" stroke="#24150a" stroke-opacity="0.38" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');
      var cracks = '';
      for (var cr = 0; cr < 26; cr++) {
        var ci2 = Math.floor(rb() * SM);
        var cx3 = cen[ci2].x + (rb() - 0.5) * 1.6 * cen[ci2].hw;
        cracks += 'M' + r1(cx3) + ' ' + r1(cen[ci2].y) + 'l' + r1((rb() - 0.5) * 16) + ' ' + r1(-5 - rb() * 9);
      }
      trunk.push('<path d="' + cracks + '" fill="none" stroke="#1d1005" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round"/>');
      // knot hole
      var ki = Math.floor(SM * 0.38);
      var kx = cen[ki].x - cen[ki].hw * 0.22, ky = cen[ki].y;
      trunk.push('<ellipse cx="' + r1(kx) + '" cy="' + r1(ky) + '" rx="15" ry="24" fill="#6d4724" stroke="#2e1b0b" stroke-width="2.5"/>' +
        '<ellipse cx="' + r1(kx + 1) + '" cy="' + r1(ky + 3) + '" rx="9" ry="17" fill="#1d1005"/>');
      // moss at the foot
      trunk.push('<g fill="#4f8a3a" opacity="0.55"><ellipse cx="' + r1(ox - wb * 0.28) + '" cy="' + r1(yb - 22) + '" rx="' + r1(wb * 0.16) + '" ry="16"/>' +
        '<ellipse cx="' + r1(ox + wb * 0.05) + '" cy="' + r1(yb - 12) + '" rx="' + r1(wb * 0.1) + '" ry="11"/></g>');
      out.push(trunk.join(''));

      /* ---- limbs: dark outline first, then wood, then sun highlight and bark ---- */
      out.push('<path d="' + branchDark.join('') + '" fill="#2f1c0c"/>');
      out.push('<path d="' + branchMid.join('') + '" fill="#84552a"/>');
      out.push('<path d="' + branchHi.join('') + '" fill="#cf9f63" opacity="0.6"/>');
      if (branchBark.length) {
        out.push('<path d="' + branchBark.join('') + '" fill="none" stroke="#2a1809" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="4 11" stroke-linecap="round"/>');
      }
      if (twigs.length) {
        out.push('<path d="' + twigs.join('') + '" fill="none" stroke="#3b2410" stroke-width="4.6" stroke-linecap="round"/>');
        out.push('<path d="' + twigs.join('') + '" fill="none" stroke="#7c5129" stroke-width="2.8" stroke-linecap="round"/>');
      }
      // leaf bunches at the twig tips (in front of the limbs, but small)
      var tl2 = [];
      tipLeaves.forEach(function (tb) {
        var rt = rng(tb.seed);
        for (var j = 0; j < tb.n; j++) {
          var ang = rt() * Math.PI * 2, rad = Math.sqrt(rt()) * 24;
          var lit2 = (Math.cos(ang) - Math.sin(ang)) / 2;
          var ci3 = clamp(Math.floor((0.55 + lit2 * 0.4 + (rt() - 0.5) * 0.5) * LEAF_COLORS.length), 0, LEAF_COLORS.length - 1);
          tl2.push(leafUse(tb.x + Math.cos(ang) * rad, tb.y + Math.sin(ang) * rad * 0.8, rt() * 360, 0.8 + rt() * 0.6, LEAF_COLORS[ci3]));
        }
      });
      out.push('<g stroke="#2f5a25" stroke-width="0.7" stroke-opacity="0.7">' + tl2.join('') + '</g>');
    }

    /* ---------- ground details drawn in front of the foot of the trunk ---------- */
    out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 30) + '" rx="' + r1(trunkW * 0.62) + '" ry="11" fill="#3f7a34" opacity="0.9"/>');
    // rocks
    for (var rk2 = 0; rk2 < 3; rk2++) {
      var rxp = ox + (rk2 === 0 ? -1 : 1) * (trunkW * (0.95 + scene() * 0.9)) + (rk2 === 2 ? trunkW * 1.4 : 0);
      var ryp = Yg + 38 + scene() * 26, rw2 = 20 + scene() * 22;
      out.push('<ellipse cx="' + r1(rxp) + '" cy="' + r1(ryp) + '" rx="' + r1(rw2) + '" ry="' + r1(rw2 * 0.6) + '" fill="url(#ft-rock)" stroke="#575d65" stroke-width="1.5"/>');
    }
    // grass: darker back row and brighter front row
    function grass(count, y0, y1, color, hmin, hrng) {
      var tufts = '';
      for (var tI = 0; tI < count; tI++) {
        var tx = scene() * W, ty = Yg + y0 + scene() * (y1 - y0);
        if (scene() < 0.4) { tx = ox + (scene() - 0.5) * trunkW * 3.4; ty = Yg + 14 + scene() * 40; }
        var hh = hmin + scene() * hrng;
        tufts += 'M' + r1(tx) + ' ' + r1(ty) + 'q-4 ' + r1(-hh * 0.6) + ' -8 ' + r1(-hh) +
          'M' + r1(tx) + ' ' + r1(ty) + 'q0 ' + r1(-hh * 0.7) + ' 1 ' + r1(-hh * 1.2) +
          'M' + r1(tx) + ' ' + r1(ty) + 'q4 ' + r1(-hh * 0.55) + ' 9 ' + r1(-hh * 0.95);
      }
      out.push('<path d="' + tufts + '" fill="none" stroke="' + color + '" stroke-width="2.6" stroke-linecap="round"/>');
    }
    var tuftCount = Math.min(170, Math.round(W / 14));
    grass(tuftCount, 4, 60, '#3c7a32', 12, 12);
    grass(tuftCount, 40, 120, '#55a040', 14, 16);
    // fallen leaves
    var fallen = '';
    for (var fl2 = 0; fl2 < 26; fl2++) {
      var flx = ox + (scene() - 0.5) * Math.min(W * 0.8, half * 2 + 300), fly = Yg + 24 + scene() * 100;
      fallen += leafUse(flx, fly, scene() * 360, 0.45 + scene() * 0.35, pick(FALLEN, scene));
    }
    out.push('<g opacity="0.9">' + fallen + '</g>');
    var flowers = '';
    for (var fI = 0; fI < 34; fI++) {
      var fx = ox + (scene() - 0.5) * Math.min(W * 0.8, trunkW * 7), fy = Yg + 14 + scene() * 100;
      var fr = 3.5 + scene() * 3;
      flowers += '<g><path d="M' + r1(fx) + ' ' + r1(fy) + 'v' + r1(fr * 3) + '" stroke="#3f7a34" stroke-width="2"/>' +
        '<circle cx="' + r1(fx) + '" cy="' + r1(fy) + '" r="' + r1(fr) + '" fill="' + pick(FLOWERS, scene) + '"/>' +
        '<circle cx="' + r1(fx) + '" cy="' + r1(fy) + '" r="' + r1(fr * 0.35) + '" fill="#ffb300"/></g>';
    }
    out.push(flowers);

    /* ---------- name tags ---------- */
    people.forEach(function (p) {
      var q = P[p.id];
      var tw = q.w, tx = q.x - tw / 2, ty = q.y - TAGH / 2;
      var label = p.wife ? (p.name + ' & ' + p.wife) : p.name;
      tags.push('<g><rect x="' + r1(tx + 2) + '" y="' + r1(ty + 3) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#000" opacity="0.2"/>' +
        '<rect x="' + r1(tx) + '" y="' + r1(ty) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#f8e7c3" stroke="#4b3019" stroke-width="2"/>' +
        '<text x="' + r1(q.x) + '" y="' + r1(q.y + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="#2f1d0c">' +
        esc(label) + '</text></g>');
    });
    out.push(tags.join(''));

    /* ---------- title ---------- */
    var title = String(data.title || '');
    var fs = Math.max(30, 64 - Math.max(0, Array.from(title).length - 14) * 1.6);
    var tcx = W / 2;
    out.push('<text x="' + r1(tcx) + '" y="100" text-anchor="middle" dominant-baseline="central" font-size="' + r1(fs) +
      '" font-weight="800" fill="#3a2714">' + esc(title) + '</text>');
    var span = Math.min(420, Math.max(220, Array.from(title).length * fs * 0.36));
    out.push('<path d="M' + r1(tcx - span) + ' 150Q' + r1(tcx) + ' 176 ' + r1(tcx + span) + ' 150" fill="none" stroke="#7a4f27" stroke-width="4" stroke-linecap="round"/>');
    [-1, 1].forEach(function (sd) {
      out.push('<use href="#ft-lf1" xlink:href="#ft-lf1" transform="translate(' + r1(tcx + sd * (span + 6)) + ' 150) rotate(' + (sd < 0 ? 200 : -20) + ') scale(1.3)" fill="#62a043" stroke="#2f5a25" stroke-width="0.8"/>');
    });

    out.push('</svg>');
    return { svg: out.join(''), width: W, height: H };
  }

  return { build: build };
});
