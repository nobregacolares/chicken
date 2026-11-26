'use strict';
// Validates the result sent in an issue and appends it to data/scores.json.
// Trust-based ranking: the game runs in the browser, so we can only block what is impossible.
const fs = require('fs');
const FILE = 'data/scores.json';
const MODES = ['normal', 'strafe', 'precisao'];
const MIN_HITS = 15; // same as the game

function sanitizeName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>`@]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}

function validate(r) {
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!r || r.v !== 1) return 'unknown format';
  if (!MODES.includes(r.mode)) return 'invalid mode';
  if (!int(r.hits, 1, 120) || !int(r.shots, r.hits, 600)) return 'hits/shots outside what is possible in 60 s';
  if (!int(r.heads, 0, r.hits)) return 'invalid headshots';
  if (!int(r.esc, 0, 200) || !int(r.perfect ?? 0, 0, r.hits)) return 'invalid counts';
  if (!int(r.ovos, r.hits, 7 * r.hits)) return 'eggs incompatible with hits';
  if (r.mode !== 'precisao' && r.ovos !== r.hits + 2 * r.heads) return 'eggs do not match hits and headshots';
  if (r.mode === 'precisao' && r.ovos > r.hits + r.heads + 4 * (r.perfect ?? 0) + Math.min(r.heads, r.perfect ?? 0)) return 'eggs do not match one-shot kills';
  if (!(typeof r.acc === 'number') || Math.abs(r.acc - Math.round(r.hits / r.shots * 1000) / 10) > 0.11) return 'accuracy does not match shots/hits';
  if (r.hits >= MIN_HITS) {
    if (!(typeof r.rt === 'number') || r.rt < 150 || r.rt > 3000) return 'average reaction outside what is possible (150 to 3000 ms)';
  }
  return null;
}

// Every match is appended as ONE row. Nothing is overwritten.
function record(body, author, data) {
  const m = /```json\s*([\s\S]*?)```/.exec(body || '');
  if (!m) return { ok: false, msg: 'Could not find the result JSON in the issue body.' };
  let r; try { r = JSON.parse(m[1]); } catch { return { ok: false, msg: 'The result JSON is broken.' }; }
  const bad = validate(r);
  if (bad) return { ok: false, msg: 'Submission rejected: ' + bad + '.' };
  const name = sanitizeName(r.nick) || author;
  data.modes = data.modes || {}; for (const k of MODES) data.modes[k] = data.modes[k] || [];
  const qualifies = r.hits >= MIN_HITS;
  const row = { name, login: author, ovos: r.ovos, acc: r.acc, rt: qualifies ? r.rt : null, hits: r.hits, heads: r.heads, t: new Date().toISOString() };
  const list = data.modes[r.mode];
  list.push(row);
  data.updated = row.t;
  const pos = (ok, cmp) => list.filter(ok).sort(cmp).indexOf(row) + 1;
  const places = [`eggs #${pos(x => x.ovos > 0, (a, b) => b.ovos - a.ovos || b.acc - a.acc)}`];
  if (qualifies) {
    places.push(`accuracy #${pos(x => x.hits >= MIN_HITS && x.acc != null, (a, b) => b.acc - a.acc || b.hits - a.hits)}`);
    if (row.rt) places.push(`reaction #${pos(x => x.hits >= MIN_HITS && x.rt > 0, (a, b) => a.rt - b.rt)}`);
  }
  const resumo = `${name} (@${author}) · ${r.mode} · ${r.ovos} eggs · ${r.acc}% accuracy` + (row.rt ? ` · ${row.rt} ms` : '');
  const extra = qualifies ? '' : `\n\nAccuracy and reaction lists only count matches with ${MIN_HITS}+ hits; this match had ${r.hits}.`;
  return { ok: true, msg: '✅ Recorded as a new row! Position: ' + places.join(', ') + '.\n\n' + resumo + extra + '\n\nPrevious rows are kept. The ranking updates in ~1 minute.' };
}

// Converts old "best per player" entries ({id, ovos:{v,h}, acc:{v,h}, rt:{v,h}}) into plain rows.
// Values that share the same hit count are assumed to come from the same match.
function normalize(data) {
  data.modes = data.modes || {};
  for (const mode of MODES) {
    const out = [];
    for (const e of data.modes[mode] || []) {
      if (typeof e.ovos !== 'object' && typeof e.acc !== 'object' && typeof e.rt !== 'object') { out.push(e); continue; }
      const byHits = new Map();
      for (const f of ['ovos', 'acc', 'rt']) {
        const x = e[f]; if (!x || typeof x !== 'object') continue;
        if (!byHits.has(x.h)) byHits.set(x.h, { name: e.name, login: e.login, ovos: null, acc: null, rt: null, hits: x.h, heads: null, t: data.updated || null });
        byHits.get(x.h)[f] = x.v;
      }
      out.push(...byHits.values());
    }
    data.modes[mode] = out;
  }
  return data;
}

module.exports = { normalize, record, validate, sanitizeName };

if (require.main === module) {
  const data = normalize(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  const res = record(process.env.ISSUE_BODY || '', process.env.ISSUE_AUTHOR || 'anon', data);
  fs.writeFileSync('/tmp/score_msg.txt', res.msg);
  console.log(res.msg);
  if (!res.ok) process.exitCode = 2;
  else fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
}
