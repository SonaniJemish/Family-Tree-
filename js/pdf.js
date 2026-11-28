/*
 * Tiny PDF writer: ONE page that holds ONE picture (a JPEG).
 * The page has exactly the shape of the picture, so the tree is never squeezed or cropped.
 * No libraries, no print dialog: works the same on phone and computer.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FT = root.FT || {};
  root.FT.pdf = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var MAX_PT = 14400;           // PDF viewers allow at most 200 inch (14400 pt) per side

  function ascii(s) {
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
    return u;
  }

  function num(v) { return String(Math.round(v * 100) / 100); }

  /**
   * strips: [{ jpeg: Uint8Array, w, h, y }] - pieces of ONE picture, y = top of the piece in pixels.
   * imgW/imgH: size of the whole picture in pixels. Pieces may overlap by a pixel (hides hair-line gaps).
   * Returns { bytes: Uint8Array, pageW, pageH } (page size in points, same ratio as the picture).
   */
  function fromStrips(strips, imgW, imgH) {
    var pageW = imgW * 0.75, pageH = imgH * 0.75;       // 96 dpi picture -> points
    var big = Math.max(pageW, pageH);
    if (big > MAX_PT) { pageW *= MAX_PT / big; pageH *= MAX_PT / big; }
    var sx = pageW / imgW, sy = pageH / imgH;
    var N = strips.length;

    var parts = [];     // Uint8Array pieces
    var offsets = [];   // byte offset of every object (1-based)
    var len = 0;
    function push(u) { parts.push(u); len += u.length; }
    function text(s) { push(ascii(s)); }
    function obj(n, body) { offsets[n] = len; text(n + ' 0 obj\n' + body + '\nendobj\n'); }

    text('%PDF-1.4\n');
    push(new Uint8Array([37, 226, 227, 207, 211, 10]));  // binary marker comment
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    var xo = '';
    for (var i = 0; i < N; i++) xo += '/Im' + i + ' ' + (5 + i) + ' 0 R ';
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(pageW) + ' ' + num(pageH) + '] ' +
      '/Resources << /XObject << ' + xo + '>> >> /Contents 4 0 R >>');
    var content = '';
    for (i = 0; i < N; i++) {
      var st = strips[i];
      content += 'q ' + num(st.w * sx) + ' 0 0 ' + num(st.h * sy) + ' 0 ' + num(pageH - (st.y + st.h) * sy) + ' cm /Im' + i + ' Do Q\n';
    }
    obj(4, '<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');

    for (i = 0; i < N; i++) {
      var s2 = strips[i];
      offsets[5 + i] = len;
      text((5 + i) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + s2.w + ' /Height ' + s2.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + s2.jpeg.length + ' >>\nstream\n');
      push(s2.jpeg);
      text('\nendstream\nendobj\n');
    }

    var xref = len;
    var x = 'xref\n0 ' + (5 + N) + '\n0000000000 65535 f \n';
    for (i = 1; i <= 4 + N; i++) x += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    text(x + 'trailer\n<< /Size ' + (5 + N) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

    var out = new Uint8Array(len), at = 0;
    for (var p = 0; p < parts.length; p++) { out.set(parts[p], at); at += parts[p].length; }
    return { bytes: out, pageW: pageW, pageH: pageH };
  }

  /** One picture in one piece. */
  function fromJpeg(jpeg, imgW, imgH) {
    return fromStrips([{ jpeg: jpeg, w: imgW, h: imgH, y: 0 }], imgW, imgH);
  }

  return { fromJpeg: fromJpeg, fromStrips: fromStrips };
});
