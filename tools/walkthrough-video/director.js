/* Walkthrough director: cursor, walkme callouts, camera keyframes and the scene timeline.
   Runs inside the prototype page under the virtual clock (vclock.js). */
(() => {
  const VW = innerWidth, VH = innerHeight, MAXZ = 1.7;
  const now = () => window.__vnow();
  const at = (ms, fn) => setTimeout(fn, ms);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eout = x => 1 - Math.pow(1 - x, 3);

  /* ---------- styles + layer ---------- */
  const st = document.createElement('style');
  st.textContent = `
#wt{position:fixed;left:0;top:0;width:${VW}px;height:${VH}px;pointer-events:none;z-index:2147483600;font-family:Geist,Inter,system-ui,sans-serif}
#wt .ring{position:absolute;border:2px solid #1E5EF0;border-radius:12px;opacity:0;box-sizing:border-box}
#wt .tip{position:absolute;left:0;top:0;width:max-content;max-width:290px;background:#0E1B3D;color:#fff;border-radius:12px;padding:11px 15px 12px;box-shadow:0 14px 34px rgba(8,20,52,.26),0 2px 6px rgba(8,20,52,.16);opacity:0;box-sizing:border-box}
#wt .tip b{display:block;font-size:14.5px;font-weight:600;letter-spacing:-.005em;line-height:1.32}
#wt .tip span{display:block;margin-top:4px;font-size:12.5px;line-height:1.42;color:rgba(255,255,255,.74)}
#wt .tip i{position:absolute;width:12px;height:12px;background:#0E1B3D;transform:rotate(45deg);border-radius:2px}
#wt .rip{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(30,94,240,.28);opacity:0}
#wt .cur{position:absolute;left:0;top:0;width:20px;height:29px;transform-origin:2px 2px;filter:drop-shadow(0 1.5px 2px rgba(0,0,0,.32))}
body.wt-notoast #toast{opacity:0!important;visibility:hidden!important}
html,body{cursor:none!important}
`;
  document.head.appendChild(st);
  const L = document.createElement('div'); L.id = 'wt'; document.body.appendChild(L);
  const cur = document.createElement('div'); cur.className = 'cur';
  cur.innerHTML = '<svg width="20" height="29" viewBox="0 0 20 29"><path d="M1.6 1.6V23.4L6.7 18.5L10.2 26.9L13.9 25.3L10.4 17.1H17.6Z" fill="#111" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  /* ---------- target helpers ---------- */
  const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const q = s => { if (typeof s === 'function') return s(); if (s && s.nodeType) return s; return [...document.querySelectorAll(s)].find(vis) || null; };
  const qt = (s, re) => [...document.querySelectorAll(s)].find(e => vis(e) && re.test(e.textContent.trim())) || null;
  const R = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const uni = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };

  /* ---------- camera ---------- */
  let cam = { cx: VW / 2, cy: VH / 2, z: 1 }, camK = null;
  function camAt(t) {
    if (!camK) return cam;
    const p = clamp((t - camK.t0) / camK.dur, 0, 1), e = eio(p), a = camK.a, b = camK.b;
    return { cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e) };
  }
  function camRect(c) {
    const w = VW / c.z, h = VH / c.z, x = clamp(c.cx - w / 2, 0, VW - w), y = clamp(c.cy - h / 2, 0, VH - h);
    return [x, y, w, h];
  }
  function camTo(targets, dur = 900, o = {}) {
    const t = now(), from = camAt(t);
    let to;
    if (targets === 'full') to = { cx: VW / 2, cy: VH / 2, z: 1 };
    else {
      const rs = [].concat(targets).map(x => (x && x.nodeType) ? R(x) : (typeof x === 'string' || typeof x === 'function') ? R(q(x)) : x);
      const u = uni(rs), pad = o.pad == null ? 30 : o.pad;
      const z = clamp(Math.min(VW / (u.w + 2 * pad), VH / (u.h + 2 * pad)), 1, o.maxZ || MAXZ);
      to = { cx: u.x + u.w / 2, cy: u.y + u.h / 2, z };
      if (o.left != null) to.cx = o.left + VW / z / 2;
      if (o.top != null) to.cy = o.top + VH / z / 2;
      const [x, y, w, h] = camRect(to); to.cx = x + w / 2; to.cy = y + h / 2;
    }
    cam = to; camK = { t0: t, dur, a: from, b: to };
  }

  /* ---------- cursor ---------- */
  let cpos = { x: VW * .72, y: VH * .78 }, moveK = null, presses = [], ripples = [];
  function curAt(t) {
    if (!moveK) return cpos;
    const k = moveK, p = clamp((t - k.t0) / k.dur, 0, 1), e = eio(p);
    const x = k.a.x + (k.b.x - k.a.x) * e, y = k.a.y + (k.b.y - k.a.y) * e;
    const arc = Math.sin(Math.PI * e) * k.arc;
    return { x: x + k.nx * arc, y: y + k.ny * arc };
  }
  function pt(el, o = {}) {
    const r = R(el);
    return { x: r.x + r.w * (o.ax == null ? .5 : o.ax) + (o.dx || 0), y: r.y + r.h * (o.ay == null ? .55 : o.ay) + (o.dy || 0) };
  }
  function move(target, dur = 800, o = {}) {
    const t = now(), a = curAt(t), isPt = target && target.x != null, el = isPt ? null : q(target);
    const b = el ? pt(el, o) : (isPt ? target : null);
    if (!b) { console.error('move: no target ' + String(target).slice(0, 80)); return; }
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    moveK = { t0: t, dur, a, b, nx: -dy / d, ny: dx / d, arc: Math.min(60, d * .08) * (o.flip ? -1 : 1) };
    cpos = b;
  }
  function click(target, o = {}) {
    const el = q(target); if (!el) { console.error('click: no target ' + String(target).slice(0, 80)); return; }
    const t = now(); presses.push(t);
    at(90, () => { const p = curAt(now()); ripples.push({ t: now(), x: p.x, y: p.y }); if (o.fn) o.fn(el); else el.click(); });
  }

  /* ---------- callouts ---------- */
  const tips = [];
  function tip(target, title, sub, o = {}) {
    const el = q(target); if (!el) { console.error('tip: no target ' + String(target).slice(0, 80)); return null; }
    const ring = document.createElement('div'); ring.className = 'ring';
    const tp = document.createElement('div'); tp.className = 'tip';
    tp.innerHTML = '<i></i><b></b>' + (sub ? '<span></span>' : '');
    tp.querySelector('b').textContent = title; if (sub) tp.querySelector('span').textContent = sub;
    if (o.w) tp.style.maxWidth = o.w + 'px';
    L.insertBefore(ring, cur); L.insertBefore(tp, cur);
    const T = { el, ring, tp, side: o.side || 'bottom', align: o.align || 'center', pad: o.pad == null ? 6 : o.pad, t0: now(), t1: Infinity, ringOn: o.ring !== false, off: o.off || 0,
      rEl: o.ringEl ? q(o.ringEl) : null, rPad: o.ringPad == null ? (o.pad == null ? 6 : o.pad) : o.ringPad };
    if (o.round) ring.style.borderRadius = '50%';
    T.box = layoutTip(T);
    tips.push(T); return T;
  }
  function layoutTip(T) {
    const r = R(T.el), p = T.pad, rr = { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p };
    const tw = T.tp.offsetWidth, th = T.tp.offsetHeight, g = 14;
    let x, y, cx, cy;
    if (T.side === 'bottom' || T.side === 'top') {
      const ax = rr.x + rr.w / 2;
      x = T.align === 'start' ? rr.x : T.align === 'end' ? rr.x + rr.w - tw : ax - tw / 2;
      x += T.off; x = clamp(x, 12, VW - tw - 12);
      y = T.side === 'bottom' ? rr.y + rr.h + g : rr.y - g - th;
      cx = clamp((T.align === 'center' ? ax : (T.align === 'start' ? rr.x + Math.min(40, rr.w / 2) : rr.x + rr.w - Math.min(40, rr.w / 2))) - x, 16, tw - 16); cy = T.side === 'bottom' ? -6 : th - 6;
    } else {
      const ay = rr.y + rr.h / 2;
      y = clamp(ay - th / 2 + T.off, 12, VH - th - 12);
      x = T.side === 'right' ? rr.x + rr.w + g : rr.x - g - tw;
      cy = clamp(ay - y, 14, th - 14); cx = T.side === 'right' ? -6 : tw - 6;
    }
    const i = T.tp.querySelector('i'); i.style.left = (cx - 6) + 'px'; i.style.top = (cy - 6) + 'px';
    if (T.rEl) { const q2 = R(T.rEl), pp = T.rPad; T.rr = { x: q2.x - pp, y: q2.y - pp, w: q2.w + 2 * pp, h: q2.h + 2 * pp }; } else T.rr = rr;
    T.tx = x; T.ty = y;
    return { x, y, w: tw, h: th };
  }
  function untip(T, ms = 220) { if (T) { T.t1 = now(); T.out = ms; } }

  /* ---------- per-frame render ---------- */
  window.__speed = 1;
  function frame() {
    const t = now(), c = camAt(t), z = c.z;
    const p = curAt(t);
    let s = 1; presses.forEach(t0 => { const d = t - t0; if (d >= 0 && d < 260) s = Math.min(s, 1 - .16 * (d < 90 ? d / 90 : 1 - (d - 90) / 170)); });
    const k = s / Math.pow(z, .55);
    cur.style.transform = `translate(${p.x - 2 * k}px,${p.y - 2 * k}px) scale(${k})`;
    if (!cur.parentNode) L.appendChild(cur);
    ripples = ripples.filter(r => t - r.t < 520);
    [...L.querySelectorAll('.rip')].forEach(n => n.remove());
    ripples.forEach(r => { const d = (t - r.t) / 520, n = document.createElement('div'); n.className = 'rip'; n.style.left = r.x + 'px'; n.style.top = r.y + 'px'; n.style.opacity = (1 - d) * .9; n.style.transform = `scale(${(.35 + 1.1 * eout(d)) / Math.pow(z, .55)})`; L.insertBefore(n, cur); });
    for (let j = tips.length - 1; j >= 0; j--) {
      const T = tips[j]; layoutTip(T);
      const a = eout(clamp((t - T.t0) / 280, 0, 1)), d = clamp((t - T.t1) / (T.out || 220), 0, 1);
      if (d >= 1) { T.ring.remove(); T.tp.remove(); tips.splice(j, 1); continue; }
      const o = a * (1 - d), sh = 8 * (1 - a);
      const dx = T.side === 'left' ? -sh : T.side === 'right' ? sh : 0, dy = T.side === 'top' ? -sh : T.side === 'bottom' ? sh : 0;
      T.tp.style.opacity = o; T.tp.style.transform = `translate(${T.tx + dx}px,${T.ty + dy}px)`;
      if (T.ringOn) {
        const pulse = clamp((t - T.t0 - 120) / 700, 0, 1), spread = 6 * Math.sin(Math.PI * pulse);
        Object.assign(T.ring.style, { left: T.rr.x + 'px', top: T.rr.y + 'px', width: T.rr.w + 'px', height: T.rr.h + 'px', opacity: o, boxShadow: `0 0 0 ${4 + spread}px rgba(30,94,240,${.14 - .06 * pulse})` });
      } else T.ring.style.opacity = 0;
    }
  }
  window.__dirState = () => { frame(); const c = camAt(now()), p = curAt(now()); return { cam: camRect(c), cur: [p.x, p.y], speed: window.__speed, t: now(), done: !!window.__wtDone, marks: window.__marks }; };

  /* ---------- scene plumbing ---------- */
  const scr = n => '[data-s=' + n + '] ';
  window.__marks = [];
  const mark = name => window.__marks.push([name, now()]);
  const onScreen = (name, fn) => { let fired = false; const h = () => { if (!fired && location.hash === '#' + name) { fired = true; fn(); } }; addEventListener('hashchange', h); };
  const speed = (v) => { window.__speed = v; };

  window.__dir = { tip, untip, move, click, camTo, q, qt, mark };


  /* ========== 1. Guarantee Agent listing ========== */
  function sListing() {
    mark('Listing');
    const S = scr('Listing');
    const inst = () => qt(S + 'a', /Install Agent/);
    const head = () => inst().closest('.card, section');
    let t1;
    at(300, () => move({ x: 1000, y: 620 }, 1200));
    at(900, () => camTo([head(), q(S + 'section[aria-label="Key results"]'), q(S + '.hiw')], 1000, { pad: 14, top: 72 }));
    at(2700, () => move(inst, 850));
    at(2900, () => { t1 = tip(inst, 'Install it from Agent Studio', 'Set up in three steps. Nothing goes live until you say so', { side: 'bottom', align: 'end', pad: 6, w: 280 }); });
    at(4500, () => { untip(t1); camTo('full', 800); });
    at(5350, () => click(inst));
  }

  /* ========== 2. Connect tools ========== */
  onScreen('Connect', () => {
    mark('Connect'); document.body.classList.add('wt-notoast');
    const S = scr('Connect');
    let t1;
    at(900, () => camTo([qt(S + 'h1, h2', /^Connect your tools$/) || q(S + '.grid6'), S + '.grid6', S + '.cont'], 1000, { pad: 16 }));
    at(800, () => move(S + '.cont', 900, { ax: .45 }));
    at(1100, () => { t1 = tip(S + '.cont', 'Plug in every channel in one click', 'Booking sites, your website, Razorpay and WhatsApp', { side: 'top', align: 'end', pad: 4 }); });
    at(2350, () => untip(t1));
    at(2400, () => click(S + '.cont'));
    at(3700, () => camTo('full', 900));
    at(3800, () => speed(1.7));
  });

  /* ========== 3. Rules and permissions ========== */
  onScreen('Limits', () => {
    mark('Limits'); speed(1); document.body.classList.remove('wt-notoast');
    const S = scr('Limits');
    const card = re => { const h = [...document.querySelectorAll(S + 'h2, h3, b, strong, div, span')].find(e => vis(e) && e.children.length === 0 && re.test(e.textContent.trim())); return h && h.closest('.card, section.card, section'); };
    const rec = () => q(S + '.rec');
    const fullPay = () => { const e = [...document.querySelectorAll(S + '*')].find(e => vis(e) && e.children.length === 0 && /^Full payment$/.test(e.textContent.trim())); return e && (e.closest('label') || e.parentElement); };
    let t1, t2;
    at(1000, () => { t1 = tip(rec(), 'Rules recommended from your own data', 'Built from your last 90 days. Change anything', { side: 'bottom', align: 'start', pad: 4, off: 40 }); camTo([rec(), card(/^What the agent can offer$/), t1.box], 1000, { pad: 18 }); });
    at(1100, () => move(() => q(S + '#adv'), 1000));
    at(2900, () => untip(t1));
    at(3000, () => { t2 = tip(fullPay, 'You choose what it can ask for', 'Pay at hotel, an advance, a card hold or full payment', { side: 'top', align: 'end', pad: 6, w: 290 }); camTo([card(/^What the agent can offer$/), card(/^Always pay at hotel$/), card(/^Cancellation & no-show$/), t2.box], 1000, { pad: 16, left: 316 }); });
    at(3100, () => move(fullPay, 1000, { ax: .3, ay: .45 }));
    at(5000, () => { untip(t2); camTo('full', 850); });
    at(5050, () => move(() => q(S + 'a.btn[href="#Replay"]'), 800));
    at(5900, () => click(() => q(S + 'a.btn[href="#Replay"]')));
    at(6200, () => speed(2.3));
  });

  /* ========== 4. Replay + activation ========== */
  onScreen('Replay', () => {
    mark('Replay'); speed(1);
    const S = scr('Replay');
    const kpi = () => q(S + 'section[aria-label="Replay results"]');
    const val = () => [...kpi().querySelectorAll('*')].find(e => vis(e) && e.children.length === 0 && /^\+₹/.test(e.textContent.trim())) || kpi();
    let t1;
    at(1150, () => { t1 = tip(val, 'Tested on your past bookings first', 'What it would have earned over the last 90 days', { side: 'bottom', align: 'start', pad: 6 }); camTo([kpi(), t1.box], 1000, { pad: 22 }); });
    at(1250, () => move(val, 1100, { ax: 1, dx: 16, ay: .6 }));
    at(3150, () => { untip(t1); camTo('full', 850); });
    at(3200, () => move(S + '[data-go=live]', 800));
    at(4050, () => click(S + '[data-go=live]'));
    at(4160, () => { mark('Activation'); camTo([{ x: 290, y: 190, w: 1020, h: 500 }], 1000, { pad: 0 }); speed(1.8); });
    at(7240, () => speed(1));
    at(8650, () => camTo('full', 900));
    at(8750, () => move(() => q('#act .act-s[data-to=MyAgents]'), 700));
    at(9550, () => click(() => q('#act .act-s[data-to=MyAgents]')));
  });

  /* ========== 5. My Agents ========== */
  onScreen('MyAgents', () => {
    mark('MyAgents');
    const S = scr('MyAgents');
    const vd = () => q(S + 'a.btn.sm[href="#Main"]');
    const badge = () => qt(S + 'a', /^2 approvals waiting$/);
    let t1;
    at(900, () => { t1 = tip(vd, 'See what Guarantee Agent is doing', 'Results, bookings and approvals in one place', { side: 'bottom', align: 'end', pad: 5 }); camTo([badge() || vd(), vd(), t1.box], 1000, { pad: 24, maxZ: 1.45 }); });
    at(1000, () => move(vd, 900));
    at(2500, () => untip(t1));
    at(2600, () => click(vd));
    at(2650, () => camTo('full', 850));
  });

  /* ========== 6. Overview ========== */
  onScreen('Main', () => {
    mark('Main');
    const S = scr('Main');
    const chart = () => { const h = [...document.querySelectorAll(S + '*')].find(e => vis(e) && e.children.length === 0 && /^No-show rate by week$/.test(e.textContent.trim())); return h && h.closest('.card, section'); };
    let t1;
    at(1250, () => { t1 = tip(chart, 'No-shows falling week by week', 'The gap to the old policy is what it earns you', { side: 'right', pad: 4, off: 40, w: 280 }); camTo([chart(), t1.box], 1000, { pad: 18 }); });
    at(1350, () => move({ x: 470, y: 470 }, 1100));
    at(3350, () => { untip(t1); camTo('full', 800); });
    at(3400, () => move(S + 'a[href="#Bookings"]', 750));
    at(4200, () => click(S + 'a[href="#Bookings"]'));
  });

  /* ========== 7. Bookings + story drawer ========== */
  onScreen('Bookings', () => {
    mark('Bookings');
    const S = scr('Bookings');
    let t1;
    at(300, () => move(S + '.bkr', 800, { ax: .1 }));
    at(1150, () => click(S + '.bkr'));
    at(1600, () => {
      const d = q('#bkdrawer'), dt = d.querySelector('.bkdt');
      t1 = tip(dt, 'Why it asked, what it did, what happened', 'The full story behind every booking', { side: 'left', pad: 2, ring: false });
      camTo([{ x: 1160, y: 0, w: 440, h: 535 }, t1.box], 1000, { pad: 14 });
    });
    at(1700, () => move(() => q('#bkdrawer .bkdt li:nth-child(3)'), 900, { ax: .6 }));
    at(3450, () => { untip(t1); camTo('full', 800); });
    at(3450, () => move(() => q('#bkdrawer .bkdx'), 700));
    at(4200, () => click(() => q('#bkdrawer .bkdx')));
    at(4350, () => move(S + 'a[href="#Approvals"]', 750));
    at(5150, () => click(S + 'a[href="#Approvals"]'));
  });

  /* ========== 8. Approvals ========== */
  onScreen('Approvals', () => {
    mark('Approvals');
    const S = scr('Approvals');
    const btn = () => qt(S + 'button', /^Charge ₹3,100$/);
    let t1;
    at(900, () => { const card = btn().closest('section.card'); t1 = tip(btn, 'Money moves only with your approval', 'Charge or waive, it is your call', { side: 'right', pad: 5 }); camTo([card, t1.box], 1000, { pad: 20 }); });
    at(1000, () => move(btn, 1000));
    at(2700, () => untip(t1));
    at(2800, () => click(btn));
    at(3050, () => camTo('full', 700));
    at(3600, () => { mark('End'); window.__wtDone = true; });
  });

  sListing();
})();
