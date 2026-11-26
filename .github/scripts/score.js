'use strict';
// Valida o resultado enviado numa issue e atualiza data/scores.json.
// Ranking "na confiança": o jogo roda no navegador, então só dá para barrar o que é impossível.
const fs = require('fs');
const FILE = 'data/scores.json';
const MODES = ['normal', 'strafe', 'precisao'];
const MIN_HITS = 15; // igual ao jogo

function sanitizeName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>`@]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}

function validate(r) {
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!r || r.v !== 1) return 'formato desconhecido';
  if (!MODES.includes(r.mode)) return 'modo inválido';
  if (!int(r.hits, 1, 120) || !int(r.shots, r.hits, 600)) return 'acertos/tiros fora do possível em 60 s';
  if (!int(r.heads, 0, r.hits)) return 'headshots inválidos';
  if (!int(r.esc, 0, 200) || !int(r.perfect ?? 0, 0, r.hits)) return 'contagens inválidas';
  if (!int(r.ovos, r.hits, 7 * r.hits)) return 'ovos incompatíveis com os acertos';
  if (r.mode !== 'precisao' && r.ovos !== r.hits + 2 * r.heads) return 'ovos não batem com acertos e headshots';
  if (r.mode === 'precisao' && r.ovos > r.hits + r.heads + 4 * (r.perfect ?? 0) + Math.min(r.heads, r.perfect ?? 0)) return 'ovos não batem com os tiros únicos';
  if (!(typeof r.acc === 'number') || Math.abs(r.acc - Math.round(r.hits / r.shots * 1000) / 10) > 0.11) return 'precisão não bate com tiros/acertos';
  if (r.hits >= MIN_HITS) {
    if (!(typeof r.rt === 'number') || r.rt < 150 || r.rt > 3000) return 'reação média fora do possível (150 a 3000 ms)';
  }
  return null;
}

function merge(list, id, name, login, r) {
  let e = list.find(x => x.id === id);
  if (!e) { e = { id, name, login, ovos: null, acc: null, rt: null }; list.push(e); }
  e.name = name; e.login = login;
  const msgs = [];
  if (r.ovos > 0 && (!e.ovos || r.ovos > e.ovos.v)) { e.ovos = { v: r.ovos, h: r.hits }; msgs.push('ovos'); }
  if (r.hits >= MIN_HITS) {
    if (!e.acc || r.acc > e.acc.v || (r.acc === e.acc.v && r.hits > e.acc.h)) { e.acc = { v: r.acc, h: r.hits }; msgs.push('precisão'); }
    if (!e.rt || r.rt < e.rt.v) { e.rt = { v: r.rt, h: r.hits }; msgs.push('reação'); }
  }
  return msgs;
}

function record(body, author, data) {
  const m = /```json\s*([\s\S]*?)```/.exec(body || '');
  if (!m) return { ok: false, msg: 'Não achei o JSON do resultado no corpo da issue.' };
  let r; try { r = JSON.parse(m[1]); } catch { return { ok: false, msg: 'O JSON do resultado está quebrado.' }; }
  const bad = validate(r);
  if (bad) return { ok: false, msg: 'Envio recusado: ' + bad + '.' };
  const name = sanitizeName(r.nick) || author;
  data.modes = data.modes || {}; for (const k of MODES) data.modes[k] = data.modes[k] || [];
  const recs = merge(data.modes[r.mode], author.toLowerCase(), name, author, r);
  data.updated = new Date().toISOString();
  const resumo = `${name} (@${author}) · ${r.mode} · ${r.ovos} ovos · ${r.acc}% de precisão` + (r.rt ? ` · ${r.rt} ms` : '');
  const extra = r.hits < MIN_HITS ? `\n\nPrecisão e reação só contam com ${MIN_HITS}+ acertos; esta partida teve ${r.hits}.` : '';
  return { ok: true, msg: (recs.length ? '✅ Registrado! Novo recorde pessoal em: ' + recs.join(', ') + '.' : '✅ Recebido, mas não superou seus recordes atuais.') + '\n\n' + resumo + extra + '\n\nO ranking atualiza em ~1 minuto.' };
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
