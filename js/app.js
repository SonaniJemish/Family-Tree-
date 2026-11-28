/*
 * App: connects the store, the two views, the name popup, import/export.
 */
(function () {
  'use strict';

  var FT = window.FT;
  var io = FT.io;
  var translit = FT.translit;

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var stage = $('#stage'), world = $('#world');
  var canvasLayer = $('#canvasLayer'), treeLayer = $('#treeLayer');
  var actionbar = $('#actionbar'), emptyEl = $('#empty');
  var titleEl = $('#title'), treeTitleInput = $('#treeTitleInput'), dirtyEl = $('#dirty');
  var fileInput = $('#fileInput'), printArea = $('#printArea');

  var store = new FT.Store();
  store.load();

  var pz = new FT.PanZoom(stage, world, { ignore: '.node, .actionbar, .empty-card, .zoombar, .historybar, .canvas-title-wrap' });
  var canvas = new FT.CanvasView(canvasLayer);

  var view = 'canvas';
  var selectedId = null;
  var viewStates = { canvas: null, tree: null };
  var treeBox = { width: 1100, height: 700 };

  /* ================= rendering ================= */

  function renderTree() {
    var b = FT.TreeView.build(store.data);
    treeBox = b;
    treeLayer.innerHTML = b.svg;
  }

  function render(animate) {
    var people = store.data.people;
    emptyEl.classList.toggle('hidden', people.length > 0);
    if (titleEl) titleEl.textContent = store.data.title;
    if (treeTitleInput && document.activeElement !== treeTitleInput) {
      treeTitleInput.value = store.data.title || '';
    }
    document.title = 'Vanshaa Vali';
    if (view === 'canvas') canvas.render(people, selectedId, animate);
    else renderTree();
    updateToolbar();
    updateActionBar();
  }

  function fitView(animate) {
    if (view === 'canvas') pz.fit(canvas.getBBox(), animate, 70, 1.1);
    else pz.fit({ minX: 0, minY: 0, maxX: treeBox.width, maxY: treeBox.height }, animate, 16, 1);
  }

  function updateToolbar() {
    $('#btnUndo').disabled = !store.canUndo();
    $('#btnRedo').disabled = !store.canRedo();
    dirtyEl.classList.toggle('hidden', !(store.dirtySinceExport && store.data.people.length));
  }

  function updateActionBar() {
    if (view !== 'canvas' || !selectedId || !canvas.disp[selectedId] || !canvas.layout || !canvas.layout.pos[selectedId]) {
      actionbar.classList.add('hidden');
      return;
    }
    var d = canvas.disp[selectedId];
    var h = canvas.layout.pos[selectedId].h;
    var s = pz.s;
    var p = store.get(selectedId);
    var wifeBtn = actionbar.querySelector('[data-act="wife"]');
    if (wifeBtn) wifeBtn.textContent = p && p.wife ? 'Edit Wife' : '+ Wife';
    actionbar.classList.remove('hidden');
    var barH = actionbar.offsetHeight || 44;
    var left = s.x + s.k * d.x;
    var top = s.y + s.k * (d.y + h) + 10;
    if (top + barH > stage.clientHeight - 8) top = s.y + s.k * d.y - barH - 10;
    actionbar.style.left = Math.round(left) + 'px';
    actionbar.style.top = Math.round(top) + 'px';
  }

  function select(id) {
    selectedId = id;
    canvas.setSelected(id);
    updateActionBar();
  }

  pz.onChange(updateActionBar);
  canvas.onDraw = updateActionBar;
  window.addEventListener('resize', updateActionBar);

  store.subscribe(function (info) {
    if (selectedId && !store.get(selectedId)) selectedId = null;
    if (info.type === 'add') selectedId = info.id;
    render(info.type !== 'replace');
    if (info.type === 'replace') fitView(false);
    if (info.type === 'add' && view === 'canvas') {
      var r = canvas.targetRect(info.id);
      if (r) pz.reveal(r, true);
    }
  });

  /* ================= views ================= */

  function setView(v) {
    if (v === view) return;
    viewStates[view] = pz.getState();
    view = v;
    stage.setAttribute('data-view', v);
    canvasLayer.classList.toggle('hidden', v !== 'canvas');
    treeLayer.classList.toggle('hidden', v !== 'tree');
    $('#tabCanvas').classList.toggle('active', v === 'canvas');
    $('#tabTree').classList.toggle('active', v === 'tree');
    render(false);
    if (viewStates[v]) pz.setState(viewStates[v]);
    else fitView(false);
  }

  $('#tabCanvas').addEventListener('click', function () { setView('canvas'); });
  $('#tabTree').addEventListener('click', function () { setView('tree'); });
  $('#zIn').addEventListener('click', function () { pz.zoomBy(1.25); });
  $('#zOut').addEventListener('click', function () { pz.zoomBy(0.8); });
  $('#zFit').addEventListener('click', function () { fitView(true); });

  /* ================= clicking on the canvas ================= */

  canvasLayer.addEventListener('click', function (e) {
    var n = e.target.closest('.node');
    if (n) select(n.getAttribute('data-id'));
  });
  canvasLayer.addEventListener('dblclick', function (e) {
    var n = e.target.closest('.node');
    if (n) openEdit(n.getAttribute('data-id'));
  });
  stage.addEventListener('click', function (e) {
    if (e.target.closest('.node, .actionbar, .zoombar, .historybar, .empty-card, .canvas-title-wrap')) return;
    if (pz.justDragged) return;
    if (view === 'canvas') select(null);
  });

  actionbar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !selectedId) return;
    var act = b.getAttribute('data-act');
    if (act === 'parent') openParent(selectedId);
    else if (act === 'child') openChild(selectedId);
    else if (act === 'sibling') openSibling(selectedId);
    else if (act === 'wife') openWife(selectedId);
    else if (act === 'edit') openEdit(selectedId);
    else if (act === 'delete') doDelete(selectedId);
  });

  /* ================= actions ================= */

  function openParent(id) { openModal('parent', id, ''); }
  function openChild(id) { openModal('child', id, ''); }
  function openSibling(id) { openModal('sibling', id, ''); }
  function openWife(id) { var p = store.get(id); if (p) openModal('wife', id, p.wife || ''); }
  function openEdit(id) { var p = store.get(id); if (p) openModal('edit', id, p.name); }

  function doDelete(id) {
    var p = store.get(id);
    if (!p) return;
    var n = store.countDescendants(id);
    var msg = n
      ? '"' + p.name + '" aur uske neeche ke ' + n + ' log delete ho jayenge. Pakka?'
      : '"' + p.name + '" ko delete karna hai?';
    if (!window.confirm(msg)) return;
    selectedId = p.parent && store.get(p.parent) ? p.parent : null;
    store.remove(id);
  }

  $('#btnRoot').addEventListener('click', function () { openModal('root', null, ''); });
  $('#btnFirst').addEventListener('click', function () { openModal('root', null, ''); });
  $('#btnUndo').addEventListener('click', function () { store.undo(); });
  $('#btnRedo').addEventListener('click', function () { store.redo(); });
  /* ================= reusable Gujlish -> Gujarati suggestion helper ================= */

  function attachGujaratiSug(inputEl, listEl, hintEl, opts) {
    opts = opts || {};
    var st = { items: [], hi: 0, reqId: 0, pending: null, source: '' };

    function renderSug() {
      listEl.innerHTML = st.items.map(function (s, i) {
        return '<li class="' + (i === st.hi ? 'hi' : '') + '" data-i="' + i + '"><span class="num">' + (i + 1) + '</span><span class="gu">' + esc(s) + '</span></li>';
      }).join('');
      var hint = '';
      if (st.items.length) {
        if (st.source === 'pending') hint = 'Suggestions aa rahe hain...';
        else if (st.source === 'offline') hint = 'Offline suggestion (basic). Internet ho to behtar milenge.';
        else hint = 'Google suggestions';
      }
      if (hintEl) hintEl.textContent = hint;
      if (opts.onRender) opts.onRender(st.items.length > 0);
    }

    function clearSug() {
      st.items = []; st.hi = 0; st.reqId++; st.pending = null; st.source = '';
      renderSug();
    }

    function acceptSug(i) {
      var item = st.items[i];
      if (!item) return false;
      var sp = translit.splitTail(inputEl.value);
      inputEl.value = sp.head + item;
      clearSug();
      inputEl.focus();
      if (opts.onAccept) opts.onAccept(inputEl.value);
      return true;
    }

    function acceptReady(then) {
      var wait = st.pending || Promise.resolve();
      wait.then(function () {
        if (translit.splitTail(inputEl.value).tail && st.items.length) acceptSug(st.hi);
        if (then) then();
      });
    }

    inputEl.addEventListener('input', function () {
      var sp = translit.splitTail(inputEl.value);
      if (!sp.tail) { clearSug(); return; }
      var tail = sp.tail;
      st.items = [translit.offline(tail)];
      st.hi = 0;
      st.source = 'pending';
      renderSug();
      var id = ++st.reqId;
      st.pending = new Promise(function (res) { setTimeout(res, 120); })
        .then(function () { return id === st.reqId ? translit.suggest(tail) : null; })
        .then(function (r) {
          if (!r || id !== st.reqId) return;
          st.items = r.items;
          st.source = r.source;
          st.hi = 0;
          renderSug();
        });
    });

    inputEl.addEventListener('keydown', function (e) {
      var hasTail = !!translit.splitTail(inputEl.value).tail;
      if (e.key === 'Tab' && hasTail && st.items.length) {
        e.preventDefault(); acceptSug(st.hi); return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && st.items.length) {
        e.preventDefault();
        st.hi = (st.hi + (e.key === 'ArrowDown' ? 1 : st.items.length - 1)) % st.items.length;
        renderSug();
        return;
      }
      if (/^[1-9]$/.test(e.key) && hasTail && st.items.length >= parseInt(e.key, 10) && st.source !== 'pending') {
        e.preventDefault();
        acceptSug(parseInt(e.key, 10) - 1);
      }
    });

    listEl.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li');
      if (!li) return;
      e.preventDefault();
      acceptSug(parseInt(li.getAttribute('data-i'), 10));
    });

    return { clear: clearSug, acceptReady: acceptReady, hasItems: function () { return st.items.length > 0; } };
  }

  if (titleEl) titleEl.addEventListener('dblclick', function () { openModal('title', null, store.data.title); });
  if (treeTitleInput) {
    var titleBeforeEdit = '';
    var titleSugBox = $('#titleSugBox');
    var titleSug = attachGujaratiSug(treeTitleInput, $('#titleSugList'), $('#titleSugHint'), {
      onRender: function (has) { if (titleSugBox) titleSugBox.classList.toggle('hidden', !has); },
      onAccept: function (val) {
        store.data.title = val;
        store._persist();
        store.dirtySinceExport = true;
        updateToolbar();
      }
    });
    function commitTitleInput() {
      var next = treeTitleInput.value.trim() || io.DEFAULT_TITLE;
      if (next !== titleBeforeEdit) {
        store.data.title = titleBeforeEdit;
        store.setTitle(next);
        titleBeforeEdit = store.data.title;
      } else {
        treeTitleInput.value = store.data.title;
      }
    }
    treeTitleInput.addEventListener('focus', function () {
      titleBeforeEdit = store.data.title || '';
      if (treeTitleInput.value === io.DEFAULT_TITLE) treeTitleInput.select();
    });
    treeTitleInput.addEventListener('input', function () {
      store.data.title = treeTitleInput.value;
      store._persist();
      store.dirtySinceExport = true;
      updateToolbar();
    });
    treeTitleInput.addEventListener('blur', function () {
      if (titleSug.hasItems()) {
        titleSug.acceptReady(commitTitleInput);
      } else {
        titleSug.clear();
        commitTitleInput();
      }
    });
    treeTitleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (translit.splitTail(treeTitleInput.value).tail) titleSug.acceptReady(null);
        else treeTitleInput.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (titleSug.hasItems()) { titleSug.clear(); return; }
        treeTitleInput.value = titleBeforeEdit;
        store.data.title = titleBeforeEdit;
        store._persist();
        treeTitleInput.blur();
      }
    });
  }

  $('#btnSample').addEventListener('click', function () {
    var res = io.normalize(FT.sample.people, FT.sample.title);
    if (res.ok) { selectedId = null; store.replaceAll(res.data); }
  });

  /* ================= name popup with Gujlish suggestions ================= */

  var modal = $('#modal'), input = $('#nameInput'), sugList = $('#sugList'), sugHint = $('#sugHint');
  var m = { mode: null, target: null, items: [], hi: 0, reqId: 0, pending: null, source: '', finishing: false };

  function modalTexts() {
    var t = m.target ? store.get(m.target) : null;
    var name = t ? t.name : '';
    switch (m.mode) {
      case 'root': return ['Naya vyakti', 'Alag shuruaat (root) ke roop me add hoga'];
      case 'parent': return ['Parent ka naam', name + ' ke upar (parent) ke roop me add hoga'];
      case 'child': return ['Bache ka naam', name + ' ka bacha'];
      case 'sibling': return [t && t.parent ? 'Bhai / behen ka naam' : 'Naye root ka naam', t && t.parent ? name + ' ke saath, same parent ke neeche' : 'Alag shuruaat (root) ke roop me add hoga'];
      case 'wife': return ['Wife ka naam', name + ' ki wife (khali chhodoge to hat jayegi)'];
      case 'edit': return ['Naam badlo', 'Abhi ka naam: ' + name];
      case 'title': return ['Tree ka title', 'Ye tree design ke upar dikhega'];
      default: return ['', ''];
    }
  }

  function openModal(mode, target, initial) {
    m.mode = mode; m.target = target; m.items = []; m.hi = 0; m.reqId++; m.pending = null; m.finishing = false;
    var tx = modalTexts();
    $('#modalTitle').textContent = tx[0];
    $('#modalContext').textContent = tx[1];
    input.value = initial || '';
    renderSuggestions();
    modal.classList.remove('hidden');
    $('#mSaveMore').classList.toggle('hidden', mode === 'edit' || mode === 'title' || mode === 'wife');
    input.focus();
    input.select();
  }

  function closeModal() {
    modal.classList.add('hidden');
    m.mode = null; m.reqId++; m.items = []; m.pending = null;
  }

  function renderSuggestions() {
    sugList.innerHTML = m.items.map(function (s, i) {
      return '<li class="' + (i === m.hi ? 'hi' : '') + '" data-i="' + i + '"><span class="num">' + (i + 1) + '</span><span class="gu">' + esc(s) + '</span></li>';
    }).join('');
    var hint = '';
    if (m.items.length) {
      if (m.source === 'pending') hint = 'Suggestions aa rahe hain...';
      else if (m.source === 'offline') hint = 'Offline suggestion (basic). Internet ho to behtar milenge.';
      else hint = 'Google suggestions';
    }
    sugHint.textContent = hint;
  }

  function onInput() {
    var sp = translit.splitTail(input.value);
    if (!sp.tail) { m.items = []; m.reqId++; m.pending = null; renderSuggestions(); return; }
    var tail = sp.tail;
    m.items = [translit.offline(tail)];
    m.hi = 0;
    m.source = 'pending';
    renderSuggestions();
    var id = ++m.reqId;
    m.pending = new Promise(function (res) { setTimeout(res, 120); })
      .then(function () { return id === m.reqId ? translit.suggest(tail) : null; })
      .then(function (r) {
        if (!r || id !== m.reqId) return;
        m.items = r.items;
        m.source = r.source;
        m.hi = 0;
        renderSuggestions();
      });
  }

  function acceptSuggestion(i) {
    var item = m.items[i];
    if (!item) return;
    var sp = translit.splitTail(input.value);
    input.value = sp.head + item;
    m.items = [];
    m.reqId++;
    m.pending = null;
    renderSuggestions();
    input.focus();
  }

  function acceptWhenReady(then) {
    var wait = m.pending || Promise.resolve();
    wait.then(function () {
      if (translit.splitTail(input.value).tail && m.items.length) acceptSuggestion(m.hi);
      if (then) then();
    });
  }

  function save(more) {
    var name = input.value.trim();
    if (!name && m.mode !== 'wife') {
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      m.finishing = false;
      return;
    }
    var mode = m.mode, target = m.target, newId = null;
    if (mode === 'root') newId = store.addRoot(name);
    else if (mode === 'parent') newId = store.addParent(target, name);
    else if (mode === 'child') newId = store.addChild(target, name);
    else if (mode === 'sibling') newId = store.addSibling(target, name);
    else if (mode === 'wife') store.setWife(target, name);
    else if (mode === 'edit') store.rename(target, name);
    else if (mode === 'title') store.setTitle(name);

    if (more && newId && (mode === 'root' || mode === 'parent' || mode === 'child' || mode === 'sibling')) {
      if (mode === 'root' || mode === 'sibling') { m.mode = 'sibling'; m.target = newId; }
      else if (mode === 'parent') { m.target = newId; }
      var tx = modalTexts();
      $('#modalTitle').textContent = tx[0];
      $('#modalContext').textContent = tx[1];
      input.value = '';
      m.items = []; m.reqId++; m.pending = null; m.finishing = false;
      renderSuggestions();
      input.focus();
    } else {
      closeModal();
    }
  }

  function finish(more) {
    if (m.finishing) return;
    m.finishing = true;
    if (translit.splitTail(input.value).tail) acceptWhenReady(function () { save(more); });
    else save(more);
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', function (e) {
    var hasTail = !!translit.splitTail(input.value).tail;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { if (m.mode !== 'edit' && m.mode !== 'title') finish(true); else finish(false); return; }
      if (hasTail) acceptWhenReady(null);
      else finish(false);
      return;
    }
    if (e.key === 'Tab' && hasTail && m.items.length) { e.preventDefault(); acceptSuggestion(m.hi); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && m.items.length) {
      e.preventDefault();
      m.hi = (m.hi + (e.key === 'ArrowDown' ? 1 : m.items.length - 1)) % m.items.length;
      renderSuggestions();
      return;
    }
    if (/^[1-9]$/.test(e.key) && hasTail && m.items.length >= parseInt(e.key, 10) && m.source !== 'pending') {
      e.preventDefault();
      acceptSuggestion(parseInt(e.key, 10) - 1);
    }
  });

  sugList.addEventListener('mousedown', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    acceptSuggestion(parseInt(li.getAttribute('data-i'), 10));
  });
  $('#mSave').addEventListener('click', function () { finish(false); });
  $('#mSaveMore').addEventListener('click', function () { finish(true); });
  $('#mCancel').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });

  /* ================= keyboard shortcuts ================= */

  function moveSelection(key) {
    if (!store.data.people.length) return;
    if (!selectedId) {
      var firstRoot = store.data.people.filter(function (p) { return !p.parent; })[0];
      if (firstRoot) goTo(firstRoot.id);
      return;
    }
    var me = store.get(selectedId);
    var next = null;
    if (key === 'ArrowUp') next = me.parent ? store.get(me.parent) : null;
    else if (key === 'ArrowDown') next = store.childrenOf(me.id)[0] || null;
    else {
      var sibs = store.siblingsOf(me.id);
      var i = sibs.indexOf(me);
      next = sibs[i + (key === 'ArrowRight' ? 1 : -1)] || null;
    }
    if (next) goTo(next.id);
  }

  function goTo(id) {
    select(id);
    var r = canvas.targetRect(id);
    if (r) pz.reveal(r, true);
  }

  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (!modal.classList.contains('hidden')) { finish(false); return; }
      if (treeTitleInput && document.activeElement === treeTitleInput) treeTitleInput.blur();
      if (needPeople()) exportJSON();
      return;
    }
    if (!modal.classList.contains('hidden')) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); store.redo(); return; }
    if (mod || e.altKey || view !== 'canvas') return;

    if (e.key === 'Tab' && selectedId) { e.preventDefault(); openChild(selectedId); }
    else if (e.key === 'Enter' && selectedId) { e.preventDefault(); openSibling(selectedId); }
    else if (e.key === 'F2' && selectedId) { e.preventDefault(); openEdit(selectedId); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); doDelete(selectedId); }
    else if (e.key === 'Escape') { select(null); }
    else if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) { e.preventDefault(); moveSelection(e.key); }
  });

  /* ================= import / export ================= */

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function download(name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function needPeople() {
    if (store.data.people.length) return true;
    window.alert('Pehle koi vyakti add karo.');
    return false;
  }

  function exportJSON() {
    store._persist();
    download('family-tree-' + stamp() + '.json', io.toJSON(store.data), 'application/json;charset=utf-8');
    store.markExported();
  }

  function exportPNG() {
    var b = FT.TreeView.build(store.data);
    var blob = new Blob([b.svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(2, 8000 / Math.max(b.width, b.height));
      var c = document.createElement('canvas');
      c.width = Math.round(b.width * scale);
      c.height = Math.round(b.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (png) { download('family-tree-' + stamp() + '.png', png); }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      window.alert('Image nahi ban payi. Print / PDF try karo.');
    };
    img.src = url;
  }

  function exportPrint() {
    var b = FT.TreeView.build(store.data);
    var oldStyle = document.getElementById('printPageStyle');
    if (oldStyle) oldStyle.remove();
    var wMm = (b.width * 25.4 / 96).toFixed(2);
    var hMm = (b.height * 25.4 / 96).toFixed(2);
    var st = document.createElement('style');
    st.id = 'printPageStyle';
    st.textContent = '@media print { @page { size: ' + wMm + 'mm ' + hMm + 'mm; margin: 0; } }';
    document.head.appendChild(st);
    printArea.innerHTML = b.svg;
    document.body.classList.add('printing');
    window.print();
  }
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('printing');
    printArea.innerHTML = '';
    var st = document.getElementById('printPageStyle');
    if (st) st.remove();
  });

  var exportMenu = $('#exportMenu');
  $('#btnExport').addEventListener('click', function (e) {
    e.stopPropagation();
    exportMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', function () { exportMenu.classList.add('hidden'); });
  exportMenu.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    exportMenu.classList.add('hidden');
    if (!needPeople()) return;
    var kind = b.getAttribute('data-exp');
    if (kind === 'json') exportJSON();
    else if (kind === 'csv') { download('family-tree-' + stamp() + '.csv', io.toCSV(store.data), 'text/csv;charset=utf-8'); store.markExported(); }
    else if (kind === 'png') exportPNG();
    else if (kind === 'print') exportPrint();
  });

  function chooseFile() { fileInput.click(); }
  $('#btnImport').addEventListener('click', chooseFile);
  $('#btnImport2').addEventListener('click', chooseFile);
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var res = io.parseAny(rd.result, f.name);
      fileInput.value = '';
      if (!res.ok) { window.alert('Import nahi hua: ' + res.error); return; }
      if (res.format === 'csv') res.data.title = store.data.title; // CSV me title nahi hota
      var cur = store.data.people.length;
      if (cur && !window.confirm('Abhi ke ' + cur + ' log ki jagah file ke ' + res.data.people.length + ' log aa jayenge. Aage badhein? (Undo se wapas aa sakta hai)')) return;
      selectedId = null;
      store.replaceAll(res.data);
    };
    rd.onerror = function () { fileInput.value = ''; window.alert('File padh nahi paya.'); };
    rd.readAsText(f, 'utf-8');
  });

  /* ================= start ================= */

  render(false);
  fitView(false);

  // handy for tests / debugging in the browser console
  window.FTApp = { store: store, pz: pz, canvas: canvas, getView: function () { return view; }, getSelected: function () { return selectedId; } };
})();
