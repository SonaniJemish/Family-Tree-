/*
 * Store: holds the family data, auto-saves to the browser, undo / redo.
 */
(function (root, factory) {
  var api = factory(root.FT && root.FT.io ? root.FT.io : (typeof require === 'function' ? require('./io.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FT = root.FT || {};
  root.FT.Store = api.Store;
})(typeof self !== 'undefined' ? self : globalThis, function (io) {
  'use strict';

  var KEY = 'familyTree.v1';
  var MAX_UNDO = 100;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function Store(storage) {
    this.storage = storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
    this.data = io.emptyData();
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
    this.dirtySinceExport = false;
  }

  Store.prototype.subscribe = function (fn) { this.listeners.push(fn); };

  Store.prototype._emit = function (info) {
    this._persist();
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](info || {});
  };

  Store.prototype._persist = function () {
    if (!this.storage) return;
    try { this.storage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ }
  };

  Store.prototype.load = function () {
    if (!this.storage) return false;
    try {
      var raw = this.storage.getItem(KEY);
      if (!raw) return false;
      var res = io.parseJSON(raw);
      if (!res.ok) return false;
      this.data = res.data;
      return true;
    } catch (e) { return false; }
  };

  Store.prototype._pushUndo = function () {
    this.undoStack.push(JSON.stringify(this.data));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  };

  Store.prototype.canUndo = function () { return this.undoStack.length > 0; };
  Store.prototype.canRedo = function () { return this.redoStack.length > 0; };

  Store.prototype.undo = function () {
    if (!this.undoStack.length) return false;
    this.redoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(this.undoStack.pop());
    this.dirtySinceExport = true;
    this._emit({ type: 'undo' });
    return true;
  };

  Store.prototype.redo = function () {
    if (!this.redoStack.length) return false;
    this.undoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(this.redoStack.pop());
    this.dirtySinceExport = true;
    this._emit({ type: 'redo' });
    return true;
  };

  Store.prototype._newId = function () {
    var ids = {};
    this.data.people.forEach(function (p) { ids[p.id] = true; });
    var n = this.data.nextId || 1;
    while (ids['p' + n]) n++;
    this.data.nextId = n + 1;
    return 'p' + n;
  };

  Store.prototype.get = function (id) {
    for (var i = 0; i < this.data.people.length; i++) if (this.data.people[i].id === id) return this.data.people[i];
    return null;
  };

  Store.prototype.childrenOf = function (id) {
    return this.data.people.filter(function (p) { return p.parent === id; });
  };

  Store.prototype.siblingsOf = function (id) {
    var me = this.get(id);
    if (!me) return [];
    return this.data.people.filter(function (p) { return p.parent === me.parent; });
  };

  Store.prototype.countDescendants = function (id) {
    var count = 0;
    var stack = [id];
    var self = this;
    while (stack.length) {
      var cur = stack.pop();
      self.childrenOf(cur).forEach(function (c) { count++; stack.push(c.id); });
    }
    return count;
  };

  Store.prototype._mark = function () { this.dirtySinceExport = true; };

  Store.prototype.addRoot = function (name) {
    this._pushUndo();
    var id = this._newId();
    this.data.people.push({ id: id, name: String(name).trim(), parent: null });
    this._mark();
    this._emit({ type: 'add', id: id });
    return id;
  };

  Store.prototype.addChild = function (parentId, name) {
    if (!this.get(parentId)) return null;
    this._pushUndo();
    var id = this._newId();
    this.data.people.push({ id: id, name: String(name).trim(), parent: parentId });
    this._mark();
    this._emit({ type: 'add', id: id });
    return id;
  };

  /** Inserts a new parent directly above `childId` (preserving any existing grandparent). */
  Store.prototype.addParent = function (childId, name) {
    var child = this.get(childId);
    if (!child) return null;
    this._pushUndo();
    var newId = this._newId();
    var idx = this.data.people.indexOf(child);
    this.data.people.splice(idx, 0, { id: newId, name: String(name).trim(), parent: child.parent });
    child.parent = newId;
    this._mark();
    this._emit({ type: 'add', id: newId });
    return newId;
  };

  /** New person with the same parent, placed right after `id` among siblings. */
  Store.prototype.addSibling = function (id, name) {
    var me = this.get(id);
    if (!me) return null;
    this._pushUndo();
    var newId = this._newId();
    var idx = this.data.people.indexOf(me);
    this.data.people.splice(idx + 1, 0, { id: newId, name: String(name).trim(), parent: me.parent });
    this._mark();
    this._emit({ type: 'add', id: newId });
    return newId;
  };

  Store.prototype.rename = function (id, name) {
    var me = this.get(id);
    if (!me) return false;
    this._pushUndo();
    me.name = String(name).trim();
    this._mark();
    this._emit({ type: 'rename', id: id });
    return true;
  };

  Store.prototype.setWife = function (id, wifeName) {
    var me = this.get(id);
    if (!me) return false;
    this._pushUndo();
    var w = String(wifeName || '').trim();
    if (w) me.wife = w;
    else delete me.wife;
    this._mark();
    this._emit({ type: 'wife', id: id });
    return true;
  };

  Store.prototype.setTitle = function (title) {
    this._pushUndo();
    this.data.title = String(title).trim() || io.DEFAULT_TITLE;
    this._mark();
    this._emit({ type: 'title' });
  };

  /** Removes the person and everyone below. Returns how many people were removed. */
  Store.prototype.remove = function (id) {
    if (!this.get(id)) return 0;
    this._pushUndo();
    var kill = {};
    var stack = [id];
    var self = this;
    while (stack.length) {
      var cur = stack.pop();
      kill[cur] = true;
      self.childrenOf(cur).forEach(function (c) { stack.push(c.id); });
    }
    var before = this.data.people.length;
    this.data.people = this.data.people.filter(function (p) { return !kill[p.id]; });
    this._mark();
    this._emit({ type: 'remove', id: id });
    return before - this.data.people.length;
  };

  /** Replace everything (import). `data` must already be validated by io. */
  Store.prototype.replaceAll = function (data) {
    this._pushUndo();
    this.data = clone(data);
    this.dirtySinceExport = false;
    this._emit({ type: 'replace' });
  };

  Store.prototype.markExported = function () {
    this.dirtySinceExport = false;
    this._emit({ type: 'exported' });
  };

  return { Store: Store, KEY: KEY };
});
