/*
 * "Ped" view: the same family data drawn as a big, hand-drawn style illustrated tree.
 *
 *  - a wide trunk with a flared foot (the oldest people sit on the trunk)
 *  - from the first fork the family spreads like a wide crown (see layout.computeFan)
 *  - every branch is a smooth tapered limb with a dark outline: thick at the parent, thin at the child
 *  - every branch carries twigs with pointed leaves (olive-yellow and green), like a drawn tree
 *  - a soft olive-green canopy sits BEHIND the limbs, so every parent-child connection stays visible
 *  - name tags sit on the limbs; tags on thick limbs tilt along the limb
 *  - calm pale sky, hazy hills and soft bushes in the corners
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
  // olive-yellow, light green, mid green, deep green (like the reference drawing)
  var LEAF_COLORS = ['#d4ca4b', '#c5c244', '#aac24b', '#8db646', '#72a841', '#5b9439', '#487f33'];
  var LEAF_LINE = '#3f5a24';
  var WOOD = '#9b7548', WOOD_LIGHT = '#cfa56f', WOOD_DARK = '#3b2a1a';

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
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function leafColor(rnd) { return LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)]; }

  function bez(p0, c1, c2, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
    };
  }

  /**
   * A filled ribbon along a centre line with a width at every point.
   * hi = 0: normal ribbon. hi > 0: the centre line is moved towards the light (used for highlights).
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
        var sgn = (nx * 0.6 + ny * -0.8) >= 0 ? 1 : -1;
        cx += nx * sgn * ws[i] * hi;
        cy += ny * sgn * ws[i] * hi;
      }
      var hw = ws[i] / 2;
      L.push(r1(cx + nx * hw) + ' ' + r1(cy + ny * hw));
      R.push(r1(cx - nx * hw) + ' ' + r1(cy - ny * hw));
    }
    return 'M' + L.join('L') + 'L' + R.reverse().join('L') + 'Z';
  }

  function leafUse(x, y, rotDeg, sc, fill) {
    return '<use href="#ft-lf" xlink:href="#ft-lf" transform="translate(' + r1(x) + ' ' + r1(y) +
      ') rotate(' + Math.round(rotDeg) + ') scale(' + r1(sc) + ')" fill="' + fill + '"/>';
  }

  function cloud(cx, cy, s) {
    return '<g fill="#fff" opacity="0.7">' +
      '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(78 * s) + '" ry="' + r1(24 * s) + '"/>' +
      '<ellipse cx="' + r1(cx + 46 * s) + '" cy="' + r1(cy - 15 * s) + '" rx="' + r1(50 * s) + '" ry="' + r1(29 * s) + '"/>' +
      '<ellipse cx="' + r1(cx - 44 * s) + '" cy="' + r1(cy - 9 * s) + '" rx="' + r1(42 * s) + '" ry="' + r1(23 * s) + '"/></g>';
  }

  /** A small far-away tree for the hills. */
  function farTree(x, y, h, rnd) {
    var tw = h * 0.09;
    var g = '<rect x="' + r1(x - tw / 2) + '" y="' + r1(y - h * 0.42) + '" width="' + r1(tw) + '" height="' + r1(h * 0.42) + '" fill="#7d6f58"/>';
    var cols = ['#86ac73', '#93b67b', '#779f66'];
    for (var i = 0; i < 4; i++) {
      var cx = x + (rnd() - 0.5) * h * 0.34, cy = y - h * (0.55 + rnd() * 0.3), rr = h * (0.2 + rnd() * 0.12);
      g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(rr) + '" fill="' + cols[i % 3] + '"/>';
    }
    return g;
  }

  /** A soft round bush for the corners. */
  function bush(cx, cy, r, rnd) {
    var g = '';
    for (var i = 0; i < 6; i++) {
      var bx = cx + (rnd() - 0.5) * r * 1.5, by = cy + (rnd() - 0.5) * r * 0.5, br = r * (0.45 + rnd() * 0.35);
      g += '<circle cx="' + r1(bx) + '" cy="' + r1(by) + '" r="' + r1(br) + '" fill="url(#ft-bd)"/>';
      g += '<circle cx="' + r1(bx + br * 0.2) + '" cy="' + r1(by - br * 0.22) + '" r="' + r1(br * 0.62) + '" fill="url(#ft-bm)"/>';
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
    var padX = 480, padTop = 520, padBot = 360;
    var half = Math.max(Math.abs(bb.minX), Math.abs(bb.maxX));
    var W = Math.max(2200, Math.ceil(half * 2 + padX * 2));
    var ox = W / 2;
    var Yg = Math.max(1050, padTop + bb.maxY);      // ground line in picture coordinates
    var H = Math.ceil(Yg + padBot);
    function SX(x) { return ox + x; }
    function SY(y) { return Yg - y; }

    var scene = rng(hash('scene'));
    var trunkW = clamp(24 + 24 * Math.sqrt(n), 190, 380);
    var C = has ? { x: SX(F.center.x), y: SY(F.center.y) } : null;

    // Figma art (js/assets.js): real shaded leaves and a bark picture. Without it the flat drawing is used.
    var AS = FT.assets || null;
    var realLeaves = !!AS && n <= 250;      // very big trees keep the light flat leaves, so they stay fast

    var photo = !!(AS && AS.photo);
    function assetDefs() {
      var d = '';
      AS.leaves.forEach(function (L, i) { d += '<image id="ft-leaf' + (i + 1) + '" width="' + L.w + '" height="' + L.h + '" href="' + L.uri + '"/>'; });
      d += '<image id="ft-barkimg" width="' + AS.barkSize + '" height="' + AS.barkSize + '" href="' + AS.bark + '"/>';
      d += '<pattern id="ft-barkP" patternUnits="userSpaceOnUse" width="' + AS.barkSize + '" height="' + AS.barkSize + '" patternTransform="scale(' + AS.barkScale + ')"><use href="#ft-barkimg"/></pattern>';
      d += '<image id="ft-folimg" width="' + AS.foliageSize + '" height="' + AS.foliageSize + '" href="' + AS.foliage + '"/>';
      d += '<pattern id="ft-folP" patternUnits="userSpaceOnUse" width="' + AS.foliageSize + '" height="' + AS.foliageSize + '" patternTransform="scale(' + AS.foliageScale + ')"><use href="#ft-folimg"/></pattern>';
      return d;
    }

    /** One leaf: a real photographed leaf (tip up, stalk at its foot) turned so it points along rotDeg. */
    function leafAt(x, y, rotDeg, sc, rnd) {
      if (!realLeaves) return leafUse(x, y, rotDeg, sc, leafColor(rnd));
      var k = Math.floor(rnd() * AS.leaves.length);
      var L = AS.leaves[k];
      var s = (62 * sc / AS.leafLen).toFixed(3);               // about 62 px long at sc = 1
      var sx = rnd() < 0.5 ? -s : s;                           // mirror some leaves so they do not all look the same
      return '<use href="#ft-leaf' + (k + 1) + '" transform="translate(' + r1(x) + ' ' + r1(y) + ') rotate(' + Math.round(rotDeg + 90) +
        ') scale(' + sx + ' ' + s + ') translate(' + r1(-L.w / 2) + ' ' + r1(-L.h * 0.985) + ')"/>';
    }

    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT_ATTR + '">');

    /* ---------- definitions ---------- */
    out.push('<defs>' +
      '<linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cde2ec"/><stop offset="0.55" stop-color="#e5eee9"/><stop offset="1" stop-color="#f3f2e4"/></linearGradient>' +
      '<linearGradient id="ft-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cba7c"/><stop offset="1" stop-color="#6f9a52"/></linearGradient>' +
      '<linearGradient id="ft-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b4129"/><stop offset="0.25" stop-color="#8a6a45"/>' +
      '<stop offset="0.55" stop-color="#b08a5c"/><stop offset="0.78" stop-color="#977250"/><stop offset="1" stop-color="#5b4129"/></linearGradient>' +
      // soft canopy: dark base, mid tone, light yellow-green patches
      '<radialGradient id="ft-bd" cx="0.55" cy="0.4" r="0.75"><stop offset="0" stop-color="#6c9640"/><stop offset="0.65" stop-color="#5a8a3b"/><stop offset="1" stop-color="#487533"/></radialGradient>' +
      '<radialGradient id="ft-bm" cx="0.55" cy="0.4" r="0.75"><stop offset="0" stop-color="#8db04c"/><stop offset="0.65" stop-color="#7aa044"/><stop offset="1" stop-color="#679637"/></radialGradient>' +
      '<radialGradient id="ft-shade" cx="0.5" cy="0.45" r="0.62"><stop offset="0" stop-color="#0a2a08" stop-opacity="0"/><stop offset="0.62" stop-color="#0a2a08" stop-opacity="0"/><stop offset="1" stop-color="#0a2a08" stop-opacity="0.6"/></radialGradient>' +
      '<radialGradient id="ft-bl" cx="0.55" cy="0.4" r="0.7"><stop offset="0" stop-color="#bcc658"/><stop offset="0.7" stop-color="#a2b94b"/><stop offset="1" stop-color="#88aa45" stop-opacity="0.5"/></radialGradient>' +
      (AS ? assetDefs() : '') +
      '<g id="ft-lf"><path d="M0 0C7 -12 28 -14 50 0C28 14 7 12 0 0Z"/><path d="M3 0L42 0" fill="none" stroke="' + LEAF_LINE + '" stroke-width="1" stroke-opacity="0.6"/></g>' +
      '</defs>');

    /* ---------- background ---------- */
    if (photo && AS.bg) {
      // a real landscape photo: sky, far hills and a meadow. It is as wide as the picture and sits on the bottom edge,
      // so the meadow is under the trunk; above it the sky colour simply goes on.
      var bgS = Math.max(W / AS.bg.w, H * 0.8 / AS.bg.h);
      var bgW = AS.bg.w * bgS, bgH = AS.bg.h * bgS, bgX = (W - bgW) / 2, bgY = H - bgH;
      out.push('<defs><linearGradient id="ft-bgfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="0.16" stop-color="#fff"/></linearGradient>' +
        '<mask id="ft-bgmask" maskUnits="userSpaceOnUse" x="' + r1(bgX) + '" y="' + r1(bgY) + '" width="' + r1(bgW) + '" height="' + r1(bgH) + '">' +
        '<rect x="' + r1(bgX) + '" y="' + r1(bgY) + '" width="' + r1(bgW) + '" height="' + r1(bgH) + '" fill="url(#ft-bgfade)"/></mask></defs>');
      out.push('<rect width="' + W + '" height="' + H + '" fill="' + AS.bg.topColor + '"/>');
      out.push('<image x="' + r1(bgX) + '" y="' + r1(bgY) + '" width="' + r1(bgW) + '" height="' + r1(bgH) +
        '" preserveAspectRatio="none" href="' + AS.bg.uri + '" mask="url(#ft-bgmask)"/>');
    } else {
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#ft-sky)"/>');
    out.push(cloud(W * 0.12, 220, 1.1), cloud(W * 0.9, 150, 1), cloud(W * 0.76, 300, 0.7));

    /* ---------- hazy mountains, hills and far trees ---------- */
    var mt = 'M0 ' + (Yg - 60);
    var peaks = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1];
    peaks.forEach(function (p, i) { mt += 'L' + r1(W * p) + ' ' + r1(Yg - (i % 2 ? 110 : 250) - scene() * 40); });
    mt += 'V' + H + 'H0Z';
    out.push('<path d="' + mt + '" fill="#b4cbcb" opacity="0.6"/>');
    out.push('<path d="M0 ' + (Yg - 50) + 'C' + (W * 0.2) + ' ' + (Yg - 200) + ' ' + (W * 0.38) + ' ' + (Yg - 70) + ' ' + (W * 0.55) + ' ' + (Yg - 130) +
      'S' + (W * 0.88) + ' ' + (Yg - 210) + ' ' + W + ' ' + (Yg - 80) + 'V' + H + 'H0Z" fill="#bcd0b4" opacity="0.85"/>');
    out.push('<path d="M0 ' + (Yg - 20) + 'C' + (W * 0.15) + ' ' + (Yg - 100) + ' ' + (W * 0.35) + ' ' + (Yg - 30) + ' ' + (W * 0.5) + ' ' + (Yg - 62) +
      'S' + (W * 0.85) + ' ' + (Yg - 110) + ' ' + W + ' ' + (Yg - 30) + 'V' + H + 'H0Z" fill="#a6c29c" opacity="0.92"/>');
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
    // soft bushes in the corners
    out.push(bush(W * 0.04, Yg + 20, 120, scene), bush(W * 0.96, Yg + 10, 130, scene));

    }
    // soft shadow under the crown
    var shadowRx = Math.min(half * 0.95, 900);
    out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 26) + '" rx="' + r1(shadowRx) + '" ry="34" fill="#2f5a25" opacity="' + (photo ? 0.28 : 0.2) + '"/>');

    /* ---------- the tree ---------- */
    var P = {};
    var tags = [];
    people.forEach(function (p) {
      var q = F.pos[p.id];
      P[p.id] = { x: SX(q.x), y: SY(q.y), a: q.angle, chain: q.chain, desc: q.desc, parent: q.parent, w: q.w, rot: 0 };
    });

    var branchDark = [], branchMid = [], branchHi = [], branchBark = [], twigPaths = [], sprigLeaves = [];
    var limbTex = [], barkShared = [];      // limbs that get the bark picture: {d, a}
    var anchors = [];                       // places where foliage grows: {x, y, r, leaves}
    var nodeLeaves = Math.max(5, Math.min(20, Math.round(20 - n * 0.05)));
    var maxMid = n > 600 ? 0 : (n > 150 ? 2 : 6);
    var sprigTip = n > 500 ? 1 : (n > 200 ? 2 : 3);
    var sprigAlong = n > 500 ? 0 : (n > 60 ? 1 : 2);
    var subBlobs = n > 400 ? 0 : (n > 150 ? 1 : 3);
    var trunkTopW = trunkW * 0.7;           // ONE value: width of the trunk top = start width of every limb that leaves it
    var forkW0 = 0;                       // total thickness of the limbs that leave the trunk top

    function branchWidth(desc) { return Math.min(trunkW * 0.62, 12 + 14 * Math.sqrt(desc)); }

    /** A twig with pointed leaves on both sides, ending in one leaf. */
    function sprig(sx, sy, ang, len, rnd, nL, sc) {
      var curve = (rnd() < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.3);
      var ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
      var cx = sx + Math.cos(ang - curve) * len * 0.55, cy = sy + Math.sin(ang - curve) * len * 0.55;
      twigPaths.push('M' + r1(sx) + ' ' + r1(sy) + 'Q' + r1(cx) + ' ' + r1(cy) + ' ' + r1(ex) + ' ' + r1(ey));
      var side = rnd() < 0.5 ? 1 : -1;
      for (var i = 0; i < nL; i++) {
        var t = 0.22 + 0.78 * i / nL;
        var u = 1 - t;
        var px = u * u * sx + 2 * u * t * cx + t * t * ex;
        var py = u * u * sy + 2 * u * t * cy + t * t * ey;
        var dx = 2 * u * (cx - sx) + 2 * t * (ex - cx);
        var dy = 2 * u * (cy - sy) + 2 * t * (ey - cy);
        var a = Math.atan2(dy, dx);
        side = -side;
        var la = a + side * (0.62 + rnd() * 0.4);
        sprigLeaves.push(leafAt(px, py, la * 180 / Math.PI, sc * (1.05 - t * 0.3) * (0.85 + rnd() * 0.3), rnd));
      }
      sprigLeaves.push(leafAt(ex, ey, Math.atan2(ey - cy, ex - cx) * 180 / Math.PI, sc * 0.92, rnd));
    }

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
        // limbs leaving the trunk start exactly as wide as the trunk top, so trunk and limbs join with no step
        var w0 = parentIsFan ? bw * 1.1 : trunkTopW;
        var w1 = Math.max(4, bw * 0.55);
        if (!parentIsFan) forkW0 += w0;
        var N = clamp(Math.ceil(d / 16), 8, 30);
        var pts = [], ws = [], wsMid = [], wsHi = [];
        for (var i = 0; i <= N; i++) {
          var t = i / N;
          pts.push(bez(p0, c1, c2, p3, t));
          var wi = lerp(w0, w1, Math.pow(t, 0.8));
          ws.push(wi + 5 * Math.min(1, i / 4));
          wsMid.push(wi);
          wsHi.push(Math.max(1.4, wi * 0.2));
        }
        branchDark.push(ribbon(pts, ws));
        var midD = ribbon(pts, wsMid);
        if (AS && n <= 300) {
          // the bark grooves must run along the limb: turn the picture to the limb direction
          var ref = bez(p0, c1, c2, p3, parentIsFan ? 0.5 : 0.08);  // limbs from the trunk leave it straight up: grooves match the trunk
          limbTex.push({ d: midD, a: Math.atan2(ref.y - p0.y, ref.x - p0.x) * 180 / Math.PI - 90, px: p0.x, py: p0.y });
        } else if (AS) {
          barkShared.push(midD);               // very big trees: one shared picture for all limbs (same colour)
        } else {
          branchMid.push(midD);
        }
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

        var tn = pts[N], tp = pts[N - 1];
        var tAng = Math.atan2(tn.y - tp.y, tn.x - tp.x);

        // thick limbs: the name tag tilts along the limb (only when the limb is not close to vertical)
        if (q.desc >= 3) {
          var deg = tAng * 180 / Math.PI;
          while (deg > 90) deg -= 180;
          while (deg < -90) deg += 180;
          if (Math.abs(deg) <= 50) q.rot = clamp(deg * 0.7, -30, 30);
        }

        // twigs with pointed leaves: fan at the end of the limb, plus some along it
        if (sprigTip > 0) {
          var cnt = q.desc === 0 ? sprigTip : 1;
          for (var tt = 0; tt < cnt; tt++) {
            var spread = q.desc === 0 ? (tt - (cnt - 1) / 2) * 0.8 : (rnd() < 0.5 ? -1.15 : 1.15);
            sprig(tn.x, tn.y, tAng + spread + (rnd() - 0.5) * 0.35, (q.desc === 0 ? 72 : 52) + rnd() * 42, rnd, q.desc === 0 ? 5 : 4, 0.9);
          }
        }
        for (var ta = 0; ta < sprigAlong; ta++) {
          var ti = Math.floor(N * (0.55 + rnd() * 0.35));
          var tpnt = pts[ti], tprev = pts[Math.max(0, ti - 1)];
          var base = Math.atan2(tpnt.y - tprev.y, tpnt.x - tprev.x);
          sprig(tpnt.x, tpnt.y, base + (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 0.5), 44 + rnd() * 36, rnd, 3, 0.85);
        }

        // canopy along the branch and at its end
        var steps = Math.min(maxMid, Math.floor(d / 110));
        for (var s = 1; s <= steps; s++) {
          var pt = bez(p0, c1, c2, p3, s / (steps + 1));
          anchors.push({ x: pt.x, y: pt.y, r: 72 + rnd() * 34, leaves: Math.round(nodeLeaves * 0.5) });
        }
        anchors.push({ x: q.x, y: q.y, r: 100 + rnd() * 40, leaves: nodeLeaves });
      });

      /* ---- fill empty holes inside the crown so the canopy is one full dome ---- */
      if (n <= 400) {
        var Rmax = 0, maxA = 0;
        people.forEach(function (pp) {
          var qq = P[pp.id];
          if (qq.chain) return;
          Rmax = Math.max(Rmax, Math.sqrt((qq.x - C.x) * (qq.x - C.x) + (qq.y - C.y) * (qq.y - C.y)));
          maxA = Math.max(maxA, Math.abs(qq.a));
        });
        var cell = 110, grid = {};
        var gkey = function (x, y) { return Math.floor(x / cell) + ',' + Math.floor(y / cell); };
        anchors.forEach(function (a) { var k = gkey(a.x, a.y); (grid[k] = grid[k] || []).push(a); });
        var covered = function (x, y) {
          var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
          for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) {
            var list = grid[(cx + dx) + ',' + (cy + dy)];
            if (!list) continue;
            for (var i = 0; i < list.length; i++) {
              var ddx = list[i].x - x, ddy = list[i].y - y;
              if (ddx * ddx + ddy * ddy < list[i].r * list[i].r * 0.7) return true;
            }
          }
          return false;
        };
        var added = 0;
        for (var gy = C.y - Rmax * 1.1; gy < C.y - 20 && added < 400; gy += 80) {
          for (var gx = C.x - Rmax * 1.1; gx < C.x + Rmax * 1.1 && added < 400; gx += 80) {
            var pr = Math.sqrt((gx - C.x) * (gx - C.x) + (gy - C.y) * (gy - C.y));
            if (pr < Rmax * 0.16 || pr > Rmax * 0.95) continue;
            if (Math.abs(Math.atan2(gx - C.x, C.y - gy)) > maxA) continue;
            if (covered(gx, gy)) continue;
            var fa = { x: gx, y: gy, r: 96, leaves: Math.round(nodeLeaves * 0.4) };
            anchors.push(fa);
            var fk = gkey(gx, gy);
            (grid[fk] = grid[fk] || []).push(fa);
            added++;
          }
        }
      }

      /* ---- soft olive canopy: dark base, mid tone, light patches (all BEHIND the limbs) ---- */
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
          bm += '<circle cx="' + r1(bo.x + bo.r * 0.1) + '" cy="' + r1(bo.y - bo.r * 0.1) + '" r="' + r1(bo.r * 0.78) + '"/>';
          bl2 += '<circle cx="' + r1(bo.x + bo.r * 0.2) + '" cy="' + r1(bo.y - bo.r * 0.22) + '" r="' + r1(bo.r * 0.42) + '"/>';
        });
      });
      if (photo) {
        // the crown is a real foliage photo seen through the circles (same picture everywhere, so it flows from one circle to the next);
        // a soft shade at the circle edges and a few sunny patches give it depth
        out.push('<defs><g id="ft-crown">' + bd + '</g><g id="ft-crownL">' + bl2 + '</g></defs>');
        out.push('<use href="#ft-crown" fill="url(#ft-folP)"/>');
        out.push('<use href="#ft-crown" fill="url(#ft-shade)" opacity="0.5"/>');
        out.push('<use href="#ft-crownL" fill="url(#ft-bl)" opacity="0.1"/>');
        // one big light over the whole crown: sun from the upper left (like the sky photo), shade lower right
        var cx0 = 1e9, cx1 = -1e9, cy0 = 1e9, cy1 = -1e9;
        anchors.forEach(function (a) { cx0 = Math.min(cx0, a.x - a.r); cx1 = Math.max(cx1, a.x + a.r); cy0 = Math.min(cy0, a.y - a.r); cy1 = Math.max(cy1, a.y + a.r); });
        out.push('<defs><linearGradient id="ft-sun" gradientUnits="userSpaceOnUse" x1="' + r1(cx0) + '" y1="' + r1(cy0) + '" x2="' + r1(cx1) + '" y2="' + r1(cy1) + '">' +
          '<stop offset="0" stop-color="#fff2b0" stop-opacity="0.2"/><stop offset="0.45" stop-color="#fff2b0" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#0c2a0c" stop-opacity="0.42"/></linearGradient></defs>');
        // painted ONCE over the joined crown shape (a clip path), so overlapping circles do not add up to a grey haze
        out.push('<defs><clipPath id="ft-crownclip">' + bd + '</clipPath></defs>');
        out.push('<rect x="' + r1(cx0) + '" y="' + r1(cy0) + '" width="' + r1(cx1 - cx0) + '" height="' + r1(cy1 - cy0) + '" fill="url(#ft-sun)" clip-path="url(#ft-crownclip)"/>');
      } else {
        out.push('<g fill="url(#ft-bd)">' + bd + '</g>');
        out.push('<g fill="url(#ft-bm)" opacity="0.92">' + bm + '</g>');
        out.push('<g fill="url(#ft-bl)" opacity="0.7">' + bl2 + '</g>');
      }

      /* ---- loose leaves scattered on the canopy (behind the limbs) ---- */
      var leaves = [];
      var leafBudget = 2600;                 // real leaves are pictures: keep their number small so phones stay fast
      var leafScale = 1;
      if (photo) {
        var wantLeaves = 0;
        anchors.forEach(function (a) { wantLeaves += Math.ceil(a.leaves * 0.35); });
        leafScale = wantLeaves > leafBudget ? leafBudget / wantLeaves : 1;
      }
      anchors.forEach(function (a, i) {
        var rl = rng(hash('l' + i));
        if (photo) {
          if (!realLeaves) return;           // big trees: the foliage picture alone is the crown
          var cnt = Math.round(Math.ceil(a.leaves * 0.35) * leafScale);
          for (var j2 = 0; j2 < cnt; j2++) {
            var ang2 = rl() * Math.PI * 2;
            var rad2 = a.r * (0.5 + rl() * 0.7);          // most leaves sit near the rim, so the crown edge is leafy
            leaves.push(leafAt(a.x + Math.cos(ang2) * rad2 * 1.25, a.y + Math.sin(ang2) * rad2 * 0.95 - 4, rl() * 360, 0.75 + rl() * 0.7, rl));
          }
          return;
        }
        for (var j = 0; j < a.leaves; j++) {
          var ang = rl() * Math.PI * 2;
          var rad = Math.sqrt(rl()) * a.r * 1.1;
          leaves.push(leafUse(a.x + Math.cos(ang) * rad * 1.3, a.y + Math.sin(ang) * rad * 1.0 - 4, rl() * 360, 0.7 + rl() * 0.6, leafColor(rl)));
        }
      });
      if (photo && realLeaves) {
        var rc = 120, rg = {};
        anchors.forEach(function (a) { var k = Math.floor(a.x / rc) + ',' + Math.floor(a.y / rc); (rg[k] = rg[k] || []).push(a); });
        var insideOther = function (x, y, self) {
          var cx = Math.floor(x / rc), cy = Math.floor(y / rc);
          for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) {
            var list = rg[(cx + dx) + ',' + (cy + dy)];
            if (!list) continue;
            for (var q2 = 0; q2 < list.length; q2++) {
              if (list[q2] === self) continue;
              var ex = list[q2].x - x, ey = list[q2].y - y;
              if (ex * ex + ey * ey < list[q2].r * list[q2].r * 0.85) return true;
            }
          }
          return false;
        };
        anchors.forEach(function (a, i) {
          var rr = rng(hash('r' + i));
          var cnt = Math.ceil(a.r / 11);
          for (var k = 0; k < cnt; k++) {
            var an = rr() * Math.PI * 2;
            var px = a.x + Math.cos(an) * a.r * 1.04, py = a.y + Math.sin(an) * a.r * 1.0;
            if (insideOther(px, py, a)) continue;
            leaves.push(leafAt(px, py, an * 180 / Math.PI + (rr() - 0.5) * 80, 0.95 + rr() * 0.6, rr));
          }
        });
      }
      out.push(photo ? '<g>' + leaves.join('') + '</g>' :
        '<g stroke="' + LEAF_LINE + '" stroke-width="1.2" stroke-opacity="0.75">' + leaves.join('') + '</g>');

      /* ---- trunk: flared foot, slight sway, tapering up to the fork ---- */
      var wb = trunkW, fl = trunkW * 0.34;
      var wt = trunkTopW;                    // same value the limbs start with
      var yb = Yg + 24, yt = C.y - 14;       // the trunk runs up into the fork, hidden under the limbs
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
      var topCapY = yt - wt * 0.2;
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
            var rw = lerp(32 - ri * 4, 4, Math.pow(rk / 10, 0.7));
            rws.push(rw + 5);
            rws2.push(rw);
          }
          rootDark += ribbon(rpts, rws);
          rootPaths += ribbon(rpts, rws2);
        }
      });
      trunk.push('<path d="' + rootDark + '" fill="' + WOOD_DARK + '"/>');
      trunk.push('<path d="' + rootPaths + '" fill="' + (AS ? 'url(#ft-barkP)' : '#8a6a45') + '"/>');

      trunk.push('<path d="' + trunkD + '" fill="url(#' + (AS ? 'ft-barkP' : 'ft-trunk') + ')"/>');
      // outline only along the two sides (a line across the top would look like a cut)
      trunk.push('<path d="M' + tl.join('L') + 'M' + tr.join('L') + '" fill="none" stroke="' + WOOD_DARK + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>');
      // lit band on one side, shadow band on the other side
      var litD = '', shade = '';
      for (var li = 0; li <= SM; li++) litD += (li ? 'L' : 'M') + r1(cen[li].x + cen[li].hw * 0.28) + ' ' + r1(cen[li].y);
      for (var lj = SM; lj >= 0; lj--) litD += 'L' + r1(cen[lj].x + cen[lj].hw * 0.62) + ' ' + r1(cen[lj].y);
      for (var si2 = 0; si2 <= SM; si2++) shade += (si2 ? 'L' : 'M') + r1(cen[si2].x - cen[si2].hw * 1.0) + ' ' + r1(cen[si2].y);
      for (var sj = SM; sj >= 0; sj--) shade += 'L' + r1(cen[sj].x - cen[sj].hw * 0.55) + ' ' + r1(cen[sj].y);
      trunk.push('<path d="' + litD + 'Z" fill="#e6c88f" opacity="0.22"/>');
      trunk.push('<path d="' + shade + 'Z" fill="#2b1c0e" opacity="0.22"/>');
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
      trunk.push('<path d="' + grooves + '" fill="none" stroke="' + WOOD_DARK + '" stroke-opacity="0.32" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>');
      var cracks = '';
      for (var cr = 0; cr < 22; cr++) {
        var ci2 = Math.floor(rb() * SM);
        var cx3 = cen[ci2].x + (rb() - 0.5) * 1.6 * cen[ci2].hw;
        cracks += 'M' + r1(cx3) + ' ' + r1(cen[ci2].y) + 'l' + r1((rb() - 0.5) * 16) + ' ' + r1(-5 - rb() * 9);
      }
      trunk.push('<path d="' + cracks + '" fill="none" stroke="' + WOOD_DARK + '" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>');
      // knot hole
      var ki = Math.floor(SM * 0.38);
      var kx = cen[ki].x - cen[ki].hw * 0.22, ky = cen[ki].y;
      trunk.push('<ellipse cx="' + r1(kx) + '" cy="' + r1(ky) + '" rx="15" ry="24" fill="#7a5a38" stroke="' + WOOD_DARK + '" stroke-width="2.5"/>' +
        '<ellipse cx="' + r1(kx + 1) + '" cy="' + r1(ky + 3) + '" rx="9" ry="17" fill="#2b1c0e"/>');
      // moss at the foot
      trunk.push('<g fill="#6a9a48" opacity="0.4"><ellipse cx="' + r1(ox - wb * 0.28) + '" cy="' + r1(yb - 22) + '" rx="' + r1(wb * 0.16) + '" ry="16"/>' +
        '<ellipse cx="' + r1(ox + wb * 0.05) + '" cy="' + r1(yb - 12) + '" rx="' + r1(wb * 0.1) + '" ry="11"/></g>');
      out.push(trunk.join(''));

      /* ---- limbs: dark outline first, then wood, then light edge and bark ---- */
      out.push('<path d="' + branchDark.join('') + '" fill="' + WOOD_DARK + '"/>');
      if (branchMid.length) out.push('<path d="' + branchMid.join('') + '" fill="' + WOOD + '"/>');
      if (barkShared.length) out.push('<path d="' + barkShared.join('') + '" fill="url(#ft-barkP)"/>');
      if (limbTex.length) {
        var pats = '', texD = '';
        limbTex.forEach(function (lt, i) {
          pats += '<pattern id="ft-bk' + i + '" patternUnits="userSpaceOnUse" width="' + AS.barkSize + '" height="' + AS.barkSize + '" patternTransform="translate(' + r1(lt.px) + ' ' + r1(lt.py) +
            ') rotate(' + r1(lt.a) + ') translate(' + r1(-lt.px) + ' ' + r1(-lt.py) + ') scale(' + AS.barkScale + ')"><use href="#ft-barkimg"/></pattern>';
          texD += '<path d="' + lt.d + '" fill="url(#ft-bk' + i + ')"/>';
        });
        out.push('<defs>' + pats + '</defs>' + texD);
      }
      out.push('<path d="' + branchHi.join('') + '" fill="' + WOOD_LIGHT + '" opacity="' + (AS ? 0.3 : 0.6) + '"/>');
      if (branchBark.length && !AS) {
        out.push('<path d="' + branchBark.join('') + '" fill="none" stroke="' + WOOD_DARK + '" stroke-opacity="0.28" stroke-width="2" stroke-dasharray="4 11" stroke-linecap="round"/>');
      }
      // twigs, then their pointed leaves (in front of the limbs; tags come last)
      if (twigPaths.length) {
        out.push('<path d="' + twigPaths.join('') + '" fill="none" stroke="' + WOOD_DARK + '" stroke-width="4.4" stroke-linecap="round"/>');
        out.push('<path d="' + twigPaths.join('') + '" fill="none" stroke="#a07a4e" stroke-width="2.4" stroke-linecap="round"/>');
      }
      out.push(photo ? '<g>' + sprigLeaves.join('') + '</g>' :
        '<g stroke="' + LEAF_LINE + '" stroke-width="1.2" stroke-opacity="0.85">' + sprigLeaves.join('') + '</g>');
    }

    /* ---------- ground: soft grass only ---------- */
    if (photo) {       // on the real meadow: a soft dark contact shadow instead of a flat green patch
      out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 24) + '" rx="' + r1(trunkW * 0.7) + '" ry="14" fill="#1d3a12" opacity="0.35"/>');
    } else {
      out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 30) + '" rx="' + r1(trunkW * 0.62) + '" ry="11" fill="#5d8f45" opacity="0.9"/>');
    }
    function grass(count, y0, y1, color, hmin, hrng) {
      var tufts = '';
      for (var tI = 0; tI < count; tI++) {
        var tx = scene() * W, ty = Yg + y0 + scene() * (y1 - y0);
        if (photo || scene() < 0.4) { tx = ox + (scene() - 0.5) * trunkW * 3.4; ty = Yg + 14 + scene() * 40; }
        var hh = hmin + scene() * hrng;
        tufts += 'M' + r1(tx) + ' ' + r1(ty) + 'q-4 ' + r1(-hh * 0.6) + ' -8 ' + r1(-hh) +
          'M' + r1(tx) + ' ' + r1(ty) + 'q0 ' + r1(-hh * 0.7) + ' 1 ' + r1(-hh * 1.2) +
          'M' + r1(tx) + ' ' + r1(ty) + 'q4 ' + r1(-hh * 0.55) + ' 9 ' + r1(-hh * 0.95);
      }
      out.push('<path d="' + tufts + '" fill="none" stroke="' + color + '" stroke-width="2.6" stroke-linecap="round"/>');
    }
    var tuftCount = photo ? 36 : Math.min(150, Math.round(W / 16));
    grass(tuftCount, 4, 60, '#4f8040', 12, 12);
    grass(tuftCount, 40, 120, '#6aa04e', 14, 16);

    /* ---------- name tags ---------- */
    people.forEach(function (p) {
      var q = P[p.id];
      var tw = q.w, tx = q.x - tw / 2, ty = q.y - TAGH / 2;
      var label = p.wife ? (p.name + ' & ' + p.wife) : p.name;
      var tr2 = q.rot ? ' transform="rotate(' + r1(q.rot) + ' ' + r1(q.x) + ' ' + r1(q.y) + ')"' : '';
      tags.push('<g' + tr2 + '><rect x="' + r1(tx + 2) + '" y="' + r1(ty + 3) + '" width="' + tw + '" height="' + TAGH + '" rx="11" fill="#000" opacity="0.16"/>' +
        '<rect x="' + r1(tx) + '" y="' + r1(ty) + '" width="' + tw + '" height="' + TAGH + '" rx="11" fill="#f7e9c6" stroke="#6b4a28" stroke-width="1.8"/>' +
        '<text x="' + r1(q.x) + '" y="' + r1(q.y + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="#33220f">' +
        esc(label) + '</text></g>');
    });
    out.push(tags.join(''));

    /* ---------- title (ornamental heritage banner) ---------- */
    var title = String(data.title || '').trim();
    if (title) {
      var chars = Array.from(title).length;
      var fs = Math.max(30, 56 - Math.max(0, chars - 16) * 1.4);
      var cx = W / 2, cy = 118;
      var bw = Math.max(460, Math.min(W - 260, chars * fs * 0.64 + 170));
      var bh = Math.max(90, fs + 44);
      var bx = cx - bw / 2, by = cy - bh / 2;
      var tailW = 58, tailDrop = 16;

      out.push('<defs>' +
        '<linearGradient id="ft-banner-bg" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fffaf0"/><stop offset="0.5" stop-color="#f7e7c4"/><stop offset="1" stop-color="#e8cc93"/></linearGradient>' +
        '<linearGradient id="ft-banner-tail" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#c9a565"/><stop offset="1" stop-color="#e5c88c"/></linearGradient>' +
        '</defs>');

      var banner = [];
      // left & right ribbon tails
      banner.push('<path d="M' + r1(bx + 14) + ' ' + r1(by + tailDrop) +
        'H' + r1(bx - tailW) + 'L' + r1(bx - tailW + 22) + ' ' + r1(cy + tailDrop / 2) +
        'L' + r1(bx - tailW) + ' ' + r1(by + bh + tailDrop) + 'H' + r1(bx + 14) + 'Z" fill="url(#ft-banner-tail)" stroke="#6b4a28" stroke-width="2.4" stroke-linejoin="round"/>');
      banner.push('<path d="M' + r1(bx + bw - 14) + ' ' + r1(by + tailDrop) +
        'H' + r1(bx + bw + tailW) + 'L' + r1(bx + bw + tailW - 22) + ' ' + r1(cy + tailDrop / 2) +
        'L' + r1(bx + bw + tailW) + ' ' + r1(by + bh + tailDrop) + 'H' + r1(bx + bw - 14) + 'Z" fill="url(#ft-banner-tail)" stroke="#6b4a28" stroke-width="2.4" stroke-linejoin="round"/>');
      // fold shadows under main plaque
      banner.push('<path d="M' + r1(bx) + ' ' + r1(by + bh) + 'L' + r1(bx + 18) + ' ' + r1(by + bh + tailDrop) + 'V' + r1(by + bh) + 'Z" fill="#7a5329"/>');
      banner.push('<path d="M' + r1(bx + bw) + ' ' + r1(by + bh) + 'L' + r1(bx + bw - 18) + ' ' + r1(by + bh + tailDrop) + 'V' + r1(by + bh) + 'Z" fill="#7a5329"/>');

      // main plaque shadow + body + inner gold frame
      banner.push('<rect x="' + r1(bx + 3) + '" y="' + r1(by + 6) + '" width="' + r1(bw) + '" height="' + r1(bh) + '" rx="20" fill="#000" opacity="0.16"/>');
      banner.push('<rect x="' + r1(bx) + '" y="' + r1(by) + '" width="' + r1(bw) + '" height="' + r1(bh) + '" rx="20" fill="url(#ft-banner-bg)" stroke="#5c3b1e" stroke-width="3.2"/>');
      banner.push('<rect x="' + r1(bx + 9) + '" y="' + r1(by + 9) + '" width="' + r1(bw - 18) + '" height="' + r1(bh - 18) + '" rx="14" fill="none" stroke="#b58942" stroke-width="1.6" stroke-opacity="0.75"/>');

      // decorative side diamonds & leaf flourishes
      [-1, 1].forEach(function (sd) {
        var dx = cx + sd * (bw / 2 - 34);
        banner.push('<path d="M' + r1(dx) + ' ' + r1(cy - 8) + 'L' + r1(dx + 8) + ' ' + r1(cy) + 'L' + r1(dx) + ' ' + r1(cy + 8) + 'L' + r1(dx - 8) + ' ' + r1(cy) + 'Z" fill="#b58942"/>');
        banner.push(leafUse(cx + sd * (bw / 2 + 8), cy - 10, sd < 0 ? 155 : 25, 1.05, '#5e9c43'));
        banner.push(leafUse(cx + sd * (bw / 2 + 12), cy + 12, sd < 0 ? 205 : -25, 0.9, '#7ab852'));
      });

      // title text with subtle highlight
      banner.push('<text x="' + r1(cx) + '" y="' + r1(cy + 2) + '" text-anchor="middle" dominant-baseline="central" font-size="' + r1(fs) +
        '" font-weight="800" fill="#fff" opacity="0.55">' + esc(title) + '</text>');
      banner.push('<text x="' + r1(cx) + '" y="' + r1(cy) + '" text-anchor="middle" dominant-baseline="central" font-size="' + r1(fs) +
        '" font-weight="800" fill="#3a2310">' + esc(title) + '</text>');

      out.push('<g>' + banner.join('') + '</g>');
    }

    out.push('</svg>');
    return { svg: out.join(''), width: W, height: H };
  }

  return { build: build };
});
