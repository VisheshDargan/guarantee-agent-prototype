(() => {
  const W = window; let vt = 0; const T0 = 1791900000000;
  const q = []; let seq = 0; const cancelled = new Set();
  W.setTimeout = function (fn, ms, ...a) { const id = ++seq; q.push({ id, t: vt + Math.max(0, +ms || 0), fn, a, s: seq }); return id; };
  W.clearTimeout = function (id) { cancelled.add(id); };
  W.setInterval = function (fn, ms, ...a) {
    const id = ++seq, iv = Math.max(4, +ms || 4);
    const tick = () => { if (cancelled.has(id)) return; try { fn(...a); } catch (e) { console.error(e); } q.push({ id, t: vt + iv, fn: tick, a: [], s: ++seq }); };
    q.push({ id, t: vt + iv, fn: tick, a: [], s: ++seq }); return id;
  };
  W.clearInterval = W.clearTimeout;
  let rafs = [], rid = 0;
  W.requestAnimationFrame = function (cb) { const id = ++rid; rafs.push({ id, cb }); return id; };
  W.cancelAnimationFrame = function (id) { rafs = rafs.filter(r => r.id !== id); };
  try { Object.defineProperty(performance, 'now', { value: () => vt, configurable: true }); } catch (e) {}
  Date.now = () => T0 + vt;
  const started = new WeakMap();
  function sync() {
    for (const a of document.getAnimations()) {
      let s = started.get(a);
      if (s === undefined) { s = vt; started.set(a, s); try { a.pause(); } catch (e) {} }
      try { a.currentTime = vt - s; } catch (e) {}
    }
  }
  W.__vnow = () => vt;
  W.__step = function (dt) {
    const end = vt + dt;
    for (let guard = 0; guard < 5000; guard++) {
      let b = -1;
      for (let i = 0; i < q.length; i++) { const x = q[i]; if (x.t <= end && (b < 0 || x.t < q[b].t || (x.t === q[b].t && x.s < q[b].s))) b = i; }
      if (b < 0) break;
      const x = q.splice(b, 1)[0];
      if (cancelled.has(x.id)) continue;
      vt = Math.max(vt, x.t);
      try { typeof x.fn === 'function' ? x.fn(...x.a) : (0, eval)(x.fn); } catch (e) { console.error(e); }
      sync();
    }
    vt = end;
    const r = rafs; rafs = [];
    for (const f of r) { try { f.cb(vt); } catch (e) { console.error(e); } }
    sync();
    return vt;
  };
})();
