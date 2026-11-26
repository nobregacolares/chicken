'use strict';
// Validates the result sent in an issue and updates data/scores.json.
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

function merge(list, id, name, login, r) {
  let e = list.find(x => x.id === id);
  if (!e) { e = { id, name, login, ovos: null, acc: null, rt: null }; list.push(e); }
  e.name = name; e.login = login;
  const msgs = [];
  if (r.ovos > 0 && (!e.ovos || r.ovos > e.ovos.v)) { e.ovos = { v: r.ovos, h: r.hits }; msgs.push('eggs'); }
  if (r.hits >= MIN_HITS) {
    if (!e.acc || r.acc > e.acc.v || (r.acc === e.acc.v && r.hits > e.acc.h)) { e.acc = { v: r.acc, h: r.hits }; msgs.push('accuracy'); }
    if (!e.rt || r.rt < e.rt.v) { e.rt = { v: r.rt, h: r.hits }; msgs.push('reaction'); }
  }
  return msgs;
}

function record(body, author, data) {
  const m = /```json\s*([\s\S]*?)```/.exec(body || '');
  if (!m) return { ok: false, msg: 'Could not find the result JSON in the issue body.' };
  let r; try { r = JSON.parse(m[1]); } catch { return { ok: false, msg: 'The result JSON is broken.' }; }
  const bad = validate(r);
  if (bad) return { ok: false, msg: 'Submission rejected: ' + bad + '.' };
  const name = sanitizeName(r.nick) || author;
  data.modes = data.modes || {}; for (const k of MODES) data.modes[k] = data.modes[k] || [];
  const recs = merge(data.modes[r.mode], author.toLowerCase(), name, author, r);
  data.updated = new Date().toISOString();
  const resumo = `${name} (@${author}) · ${r.mode} · ${r.ovos} eggs · ${r.acc}% accuracy` + (r.rt ? ` · ${r.rt} ms` : '');
  const extra = r.hits < MIN_HITS ? `\n\nAccuracy and reaction only count with ${MIN_HITS}+ hits; this match had ${r.hits}.` : '';
  return { ok: true, msg: (recs.length ? '✅ Recorded! New personal best in: ' + recs.join(', ') + '.' : '✅ Received, but it did not beat your current records.') + '\n\n' + resumo + extra + '\n\nThe ranking updates in ~1 minute.' };
}

module.exports = { record, validate, sanitizeName };

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const res = record(process.env.ISSUE_BODY || '', process.env.ISSUE_AUTHOR || 'anon', data);
  fs.writeFileSync('/tmp/score_msg.txt', res.msg);
  console.log(res.msg);
  if (!res.ok) process.exitCode = 2;
  else fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
}
