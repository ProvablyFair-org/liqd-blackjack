// LIQD Blackjack — INSURANCE-DECLINE RECORDER (evidence E18). Prepared 2026-10-05.
// Paste into DevTools -> Console on https://qa.liqd.com/originals/blackjack, then play hands with the
// page's own buttons until the dealer shows an Ace, and decline insurance with LIQD's own button.
//
// It records, for every request the PAGE sends to /api/v1/fast-games/blackjack-game/* and
// /api/v1/fast-games/provably-fair/*: method, path, status, the request body, the response body, and
// the text of the last button clicked (and last key pressed outside a text box) before it. It records
// NO request or response headers and NO cookies; credential-like keys are dropped from every body.
// It makes two calls of its own, both only when typed/pasted by the auditor:
//   - at install: GET  provably-fair/active  (read-only: the seed pair and nonce the hands start on)
//   - __pfBjIns.reveal(): POST provably-fair/rotate with a fresh random client seed (no bet; reveals the
//     server seed the hands were dealt from, so the hand can be re-dealt offline)
// When done:  copy(__pfBjIns.dump())   then paste into the terminal command on the run sheet.
(() => {
  if (window.__pfBjIns) { console.log('[pfBj] recorder already installed —', window.__pfBjIns.entries.length, 'entries'); return; }
  const VERSION = 'liqd-blackjack-insurance-decline-recorder 2026-10-05';
  const API = '/api/v1/fast-games/';
  const WATCH = /\/api\/v1\/fast-games\/(blackjack-game|provably-fair)\//;
  const CRED = /cookie|token|authori[sz]ation|session|password|passwd|secret|api[-_]?key|jwt|bearer|csrf|e-?mail/i;
  const scrub = (v) => Array.isArray(v) ? v.map(scrub)
    : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).filter(([k]) => !CRED.test(k)).map(([k, x]) => [k, scrub(x)])) : v;
  const parse = (t) => { if (t == null || t === '') return null; try { return scrub(JSON.parse(t)); } catch { return { unparsed: String(t).slice(0, 300) }; } };
  const log = { version: VERSION, page: location.origin + location.pathname, installedAt: new Date().toISOString(), userAgent: navigator.userAgent, entries: [] };
  let lastClick = null, lastKey = null, declinedRoundIds = new Set(), doneAnnounced = new Set();

  document.addEventListener('click', (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"], a, label, [aria-label], [title]') : null;
    if (!el) return;
    const text = [el.innerText, el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
    lastClick = { text: text.slice(0, 80), tag: el.tagName, at: new Date().toISOString() };
  }, true);
  document.addEventListener('keydown', (ev) => {
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    lastKey = { key: String(ev.key).slice(0, 20), at: new Date().toISOString() };
  }, true);

  const dataOf = (r) => (r && r.data !== undefined ? r.data : r);
  const roundOf = (d) => (d && d.round != null ? d.round : (d && d.mainBet ? d : null));
  const settled = (round) => { if (!round) return false; const h = [round.mainBet, round.splitBet].filter(Boolean); return h.length > 0 && h.every((x) => x.result && x.result !== 'pending'); };
  const card = (c) => { const [s, r] = String(c).split(':'); const n = Number(r); return (n === 1 ? 'A' : n === 11 ? 'J' : n === 12 ? 'Q' : n === 13 ? 'K' : r) + (s ? s[0] : ''); };
  const BANNER = 'font-size:16px;font-weight:bold;padding:4px;';

  const record = (method, url, reqBody, status, resText, origin) => {
    const path = new URL(url, location.href).pathname;
    const entry = { at: new Date().toISOString(), origin, method: String(method || 'GET').toUpperCase(), path, status, request: parse(reqBody), response: parse(resText), lastClick, lastKey };
    log.entries.push(entry);
    const d = dataOf(entry.response), round = roundOf(d), short = path.replace(/.*fast-games\//, '');
    let line = `[pfBj] ${log.entries.length}. ${short} -> ${status}`;
    if (round && Array.isArray(round.dealerHand)) line += ` · dealer [${round.dealerHand.map(card).join(' ')}] · you [${(round.mainBet && round.mainBet.playerHand || []).map(card).join(' ')}]`;
    console.log(line);
    if (/place-insurance-bet$/.test(path)) {
      const declined = entry.request && entry.request.acceptInsurance === false;
      if (declined && status >= 200 && status < 300) {
        const rid = round && round.id ? round.id : (log.lastOfferRoundId || null);
        if (rid) declinedRoundIds.add(rid);
        console.log('%c[pfBj] DECLINE SENT by the page: ' + JSON.stringify(entry.request) + ' (button: ' + (lastClick ? lastClick.text : 'none') + '). Finish the hand.', BANNER + 'color:#0a0');
      } else {
        console.log('%c[pfBj] That was NOT a decline (' + JSON.stringify(entry.request) + ', status ' + status + '). Finish the hand and wait for the next Ace.', BANNER + 'color:#c00');
      }
    }
    if (d && d.canBetInsured === true) {
      if (round && round.id) log.lastOfferRoundId = round.id;
      console.log('%c[pfBj] INSURANCE OFFERED (dealer shows an Ace). Screenshot now, then click NO / REJECT on the table. NOT yes.', BANNER + 'color:#e80');
    }
    if (round && round.id && declinedRoundIds.has(round.id) && settled(round) && !doneAnnounced.has(round.id)) {
      doneAnnounced.add(round.id);
      const ins = round.insuranceBet;
      console.log('%c[pfBj] E18 HAND SETTLED. insurance record on the hand: ' + (ins ? 'YES, betAmount ' + ins.betAmount : 'none') + '. Screenshot now, then type:  await __pfBjIns.reveal()', BANNER + 'color:#06c');
    }
    if (/provably-fair\/rotate$/.test(path) && status >= 200 && status < 300) {
      console.log('%c[pfBj] Seed revealed. Last step, type:  copy(__pfBjIns.dump())', BANNER + 'color:#06c');
    }
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = (init && init.method) || (input && input.method) || 'GET';
    const res = await origFetch.apply(this, arguments);
    if (WATCH.test(url)) {
      let body = init && init.body != null ? init.body : null;
      if (body == null && typeof Request !== 'undefined' && input instanceof Request) { try { body = await input.clone().text(); } catch { body = null; } }
      res.clone().text().then((t) => record(method, url, typeof body === 'string' ? body : (body == null ? null : '[non-text body]'), res.status, t, 'page')).catch(() => {});
    }
    return res;
  };
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__pfM = m; this.__pfU = String(u); return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    if (WATCH.test(this.__pfU || '')) this.addEventListener('loadend', () => {
      let text; try { text = this.responseText; } catch { try { text = typeof this.response === 'string' ? this.response : JSON.stringify(this.response); } catch { text = null; } }
      record(this.__pfM, this.__pfU, typeof body === 'string' ? body : (body == null ? null : '[non-text body]'), this.status, text, 'page');
    });
    return XS.apply(this, arguments);
  };

  // The recorder's own calls go through origFetch and are recorded with origin 'recorder'.
  const own = async (method, sub, bodyObj) => {
    const url = API + sub;
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const res = await origFetch(url, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' }, body });
    const text = await res.text();
    record(method, url, body, res.status, text, 'recorder');
    return { status: res.status, data: dataOf(parse(text)) };
  };
  log.reveal = async () => {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const r = await own('POST', 'provably-fair/rotate', { clientSeed: 'pfins' + hex });
    if (r.status < 200 || r.status >= 300) console.log('%c[pfBj] rotate refused (status ' + r.status + '). If a hand is still open, finish it and type  await __pfBjIns.reveal()  again. Still refused: use Provably Fair > Seeds > CHANGE on the page instead, then type  copy(__pfBjIns.dump())', BANNER + 'color:#c00');
    return r.status;
  };
  log.dump = () => JSON.stringify({ version: log.version, page: log.page, installedAt: log.installedAt, dumpedAt: new Date().toISOString(), userAgent: log.userAgent, entries: log.entries });
  window.__pfBjIns = log;
  own('GET', 'provably-fair/active').then((r) => {
    const a = r.data || {};
    if (r.status < 200 || r.status >= 300 || !(a.activeServerSeedHash || a.hashedServerSeed)) { console.log('%c[pfBj] recorder installed, but the seed read was refused (status ' + r.status + '). Hands still record; the cards just cannot be re-dealt. Play on: BET, then Stand, until the dealer shows an Ace.', BANNER + 'color:#e80'); return; }
    console.log('%c[pfBj] recorder installed. Seed nonce ' + a.nonce + ', hash ' + String(a.activeServerSeedHash || a.hashedServerSeed || '?').slice(0, 12) + '… Now play: BET, then Stand, until the dealer shows an Ace.', BANNER + 'color:#0a0');
  }).catch((e) => console.log('%c[pfBj] recorder installed, but the seed read failed (' + e.message + '). Reload the page and paste again.', BANNER + 'color:#c00'));
})();
