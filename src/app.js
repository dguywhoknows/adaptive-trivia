const { $, $$, h, esc, busy, toast, store, download } = Kit;

let S = Object.assign(newPlayer(), store.get('trivia.v1', {}));
const save = () => store.set('trivia.v1', S);
let extra = store.get('trivia.pool', []);
let pool = BANK.concat(extra);
const saveExtra = () => { store.set('trivia.pool', extra); pool = BANK.concat(extra); };
const byId = (id) => pool.find((q) => q.id === id);
let cat = 'Mixed', cur = null, fetching = {};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ================= shared question view ================= */
let qTimer = null;
function showQuestion(box, q, opts) {
  clearInterval(qTimer);
  box.innerHTML = '';
  const state = { done: false, assisted: false, t0: performance.now() };
  const rq = qRating(S, q), rp = cat === 'Mixed' ? S.overall : catRating(S, q.cat);
  const tb = h('span', { style: 'width:100%' });
  const after = h('div');
  const finish = (i) => {
    if (state.done) return;
    state.done = true;
    clearInterval(qTimer);
    const secs = (performance.now() - state.t0) / 1000;
    $$('.opt', box).forEach((b) => { const k = +b.dataset.i; if (k === q.answer) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); b.disabled = true; });
    lifelines.classList.add('hidden');
    const ok = i === q.answer;
    after.innerHTML = `<div class="explain"><b>${i < 0 ? 'Time’s up.' : ok ? 'Correct.' : 'Not quite.'}</b> ${esc(q.explain || '')} <span class="muted">(${secs.toFixed(1)}s)</span></div>`;
    opts.onAnswer(i, ok, secs, state.assisted, after);
  };
  const choices = h('div', { class: 'opts' }, q.options.map((o, i) => h('button', { class: 'btn opt', 'data-i': i, onclick: () => finish(i) }, h('kbd', {}, i + 1), o)));
  const lifelines = h('div', { class: 'row' },
    h('button', { class: 'btn sm ghost', onclick: (e) => { state.assisted = true; e.currentTarget.disabled = true; [0, 1, 2, 3].filter((i) => i !== q.answer).sort(() => Math.random() - 0.5).slice(0, 2).forEach((i) => $(`.opt[data-i="${i}"]`, box).classList.add('gone')); } }, '50:50'),
    h('button', { class: 'btn sm ghost', onclick: (e) => busy(e.currentTarget, async () => {
      state.assisted = true;
      const text = await AI.chat([
        { role: 'system', content: 'Give a single short hint (max 20 words) that nudges toward the correct answer WITHOUT naming it or eliminating options explicitly.' },
        { role: 'user', content: `Q: ${q.q}\nOptions: ${q.options.join(' | ')}\nCorrect: ${q.options[q.answer]}` },
      ], { temperature: 0.5, demo: `Think about: ${(q.explain || q.q).split(/[.:]/)[0].replace(new RegExp(q.options[q.answer].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…')}.` });
      after.innerHTML = `<div class="explain"><b>Hint:</b> ${esc(text)}</div>`;
    }) }, 'Hint'),
    h('span', { class: 'small muted' }, 'lifelines reduce rating gain'));
  if (!opts.lifelines) lifelines.classList.add('hidden');
  box.append(
    h('div', { class: 'qmeta' }, h('div', { class: 'row' }, h('span', { class: 'tag accent' }, q.cat), h('span', { class: 'small muted' }, 'difficulty ', h('span', { class: 'diff-dots' }, '●'.repeat(rToD(rq)) + '○'.repeat(10 - rToD(rq))))), h('span', { class: 'small muted' }, opts.meta || `question rating ${Math.round(rq)} · your chance ${Math.round(expectScore(rp, rq) * 100)}%`)),
    opts.timer ? h('div', { class: 'timer' }, tb) : '',
    h('div', { class: 'question' }, q.q), choices, lifelines, after);
  box._answer = (i) => { const b = $(`.opt[data-i="${i}"]`, box); if (b && !b.classList.contains('gone')) finish(i); };
  box._done = () => state.done;
  if (opts.timer) qTimer = setInterval(() => { const left = 1 - (performance.now() - state.t0) / 20000; tb.style.width = Math.max(0, left * 100) + '%'; if (left <= 0) finish(-1); }, 100);
}
document.addEventListener('keydown', (e) => {
  if (/input|textarea|select/i.test(e.target.tagName)) return;
  const box = { play: $('#play'), daily: $('#dailyCard'), mistakes: $('#mistList .play') }[Router.current];
  if (!box || !box._answer) return;
  if (['1', '2', '3', '4'].includes(e.key) && !box._done()) box._answer(+e.key - 1);
  else if (e.key === 'Enter' && box._done()) $('.next-btn', box)?.click();
});

/* ================= play ================= */
function next() {
  cur = pickQuestion(pool, S, cat);
  maybeFetch();
  const box = $('#play');
  if (!cur) {
    clearInterval(qTimer);
    box.innerHTML = '';
    box.append(h('div', { class: 'empty' }, AI.mode() === 'demo' ? 'You have answered every question in this category. Connect a model provider for generated questions, or recycle the ones you have seen.' : 'Generating fresh questions…'), h('button', { class: 'btn', onclick: () => { S.seen = []; save(); next(); } }, 'Recycle seen questions'));
    if (AI.mode() !== 'demo') setTimeout(next, 3000);
    return;
  }
  showQuestion(box, cur, { timer: true, lifelines: true, onAnswer: (i, ok, secs, assisted, after) => {
    const r = applyAnswer(S, cur, ok, { assisted, secs, choice: i });
    save();
    after.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn primary next-btn', onclick: next }, 'Next question'), h('span', { class: 'small muted' }, 'or press Enter')));
    renderSide(r.delta);
  } });
}
async function maybeFetch() {
  if (AI.mode() === 'demo') return;
  const target = (cat === 'Mixed' ? S.overall : catRating(S, cat)) - 70;
  const c = cat === 'Mixed' ? CATS[Math.floor(Math.random() * CATS.length)] : cat;
  if (unseen(pool, S, c).filter((q) => Math.abs(qRating(S, q) - target) < 260).length >= 3 || fetching[c]) return;
  fetching[c] = true;
  try {
    const existing = pool.filter((q) => q.cat === c).map((q) => q.q).slice(-40).join(' | ');
    const out = await AI.chat([
      { role: 'system', content: 'You write accurate, unambiguous multiple-choice trivia. Facts must be well established (avoid anything that changes yearly). Exactly one correct option, three plausible distractors. Rate difficulty 1 (everyone knows) to 10 (expert). Return JSON {"questions":[{"q":"","options":["","","",""],"answer":0,"explain":"one sentence","difficulty":1-10}]}.' },
      { role: 'user', content: `Category: ${c}. Write 6 questions with difficulty around ${rToD(target)} (spread ±2). Do NOT repeat these: ${existing}` },
    ], { json: true, temperature: 0.9, maxTokens: 2000 });
    const imp = importQuestions((out.questions || []).map((q) => Object.assign({ cat: c }, q)), pool);
    imp.questions.forEach((q) => { const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5); extra.push(Object.assign(q, { id: 'ai' + q.id.slice(1), options: order.map((k) => q.options[k]), answer: order.indexOf(q.answer) })); });
    saveExtra();
  } catch (e) { console.warn(e); } finally { fetching[c] = false; }
}
function renderSide(d = 0) {
  $('#overall').textContent = Math.round(S.overall);
  $('#band').textContent = `± ${ratingBand(S)}${S.rd > 150 ? ' (still calibrating)' : ''}`;
  $('#delta').innerHTML = d ? `<span style="color:${d > 0 ? 'var(--good)' : 'var(--bad)'};font-weight:700">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</span>` : '<span class="muted">answer to start rating</span>';
  $('#streak').textContent = `streak ${S.streak} · best ${S.best} · ${S.n} answered`;
  const hs = S.history, W = 280, H = 110, lo = Math.min(...hs) - 20, hi = Math.max(...hs) + 20;
  const x = (i) => (i / Math.max(1, hs.length - 1)) * (W - 30) + 28, y = (v) => H - 10 - ((v - lo) / (hi - lo)) * (H - 20);
  $('#hist').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Rating history"><text x="0" y="${y(hi - 20) + 4}" font-size="10" fill="var(--muted)">${Math.round(hi - 20)}</text><text x="0" y="${y(lo + 20) + 4}" font-size="10" fill="var(--muted)">${Math.round(lo + 20)}</text><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="${hs.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/><circle cx="${x(hs.length - 1)}" cy="${y(hs[hs.length - 1])}" r="4" fill="var(--accent)"/></svg>`;
  $('#byCat').innerHTML = CATS.map((c) => { const k = S.cats[c], r = k ? Math.round(k.r) : null; return `<div class="cat-row"><span>${c}</span><div class="bar"><span style="width:${r ? Math.max(4, Math.min(100, (r - 800) / 12)) : 0}%"></span></div><b class="mono" style="text-align:right">${r ?? '—'}</b></div>${k ? `<div class="small muted" style="margin:-4px 0 8px 118px">${k.right}/${k.n} correct</div>` : ''}`; }).join('');
}
['Mixed', ...CATS].forEach((c) => $('#cats').append(h('button', { class: 'btn sm' + (c === cat ? ' on' : ''), onclick: (e) => { cat = c; $$('#cats .btn').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); next(); } }, c)));
window.addEventListener('ai:change', maybeFetch);

/* ================= daily ================= */
let daily = store.get('trivia.daily', {});
const saveDaily = () => store.set('trivia.daily', daily);
function dailyStreak() { let n = 0, d = new Date(); if (!daily[today()]?.done) d.setDate(d.getDate() - 1); for (;;) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (!daily[k]?.done) return n; n++; d.setDate(d.getDate() - 1); } }
function renderDaily() {
  const day = today(), set = dailySet(BANK, day), rec = daily[day] || (daily[day] = { results: [], done: false });
  $('#dailyTitle').textContent = `Daily ten · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  const st = dailyStreak();
  $('#dailyStreak').textContent = `${st}-day streak`;
  const box = $('#dailyCard');
  const dots = () => h('div', { class: 'daily-dots' }, set.map((_, i) => h('span', { class: rec.results[i] === true ? 'ok' : rec.results[i] === false ? 'no' : '' })));
  if (rec.done || rec.results.length >= set.length) {
    rec.done = true; saveDaily();
    clearInterval(qTimer);
    box.innerHTML = '';
    const right = rec.results.filter(Boolean).length;
    box.append(h('div', { class: 'stack', style: 'align-items:center;text-align:center;padding:20px' }, h('div', { class: 'rating' }, `${right}/${set.length}`), dots(), h('p', { class: 'muted' }, 'Come back tomorrow for a new set.'),
      h('button', { class: 'btn', onclick: () => navigator.clipboard.writeText(dailyShareText(day, rec.results)).then(() => toast('Result copied')) }, 'Copy result')));
  } else {
    const i = rec.results.length, q = set[i];
    showQuestion(box, q, { timer: true, lifelines: false, meta: `question ${i + 1} of ${set.length}`, onAnswer: (choice, ok, secs, assisted, after) => {
      rec.results.push(ok); saveDaily();
      applyAnswer(S, q, ok, { secs, daily: day, choice });
      save(); renderSide();
      after.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn primary next-btn', onclick: renderDaily }, i + 1 < set.length ? 'Next' : 'See result'), dots()));
    } });
  }
  $('#dailyHist').innerHTML = Object.keys(daily).filter((k) => daily[k].done).sort().reverse().slice(0, 14).map((k) => `<div class="row between" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>${k}</span><b>${daily[k].results.filter(Boolean).length}/${daily[k].results.length}</b></div>`).join('') || '<span class="muted">No finished days yet.</span>';
}

/* ================= mistakes ================= */
let retryQueue = [];
function renderMistakes() {
  const list = mistakes(S.answers).map((m) => Object.assign(m, { q: byId(m.id) })).filter((m) => m.q);
  $('#mistSummary').textContent = list.length ? `${list.length} question${list.length === 1 ? '' : 's'} you have not got right yet.` : 'No outstanding mistakes.';
  $('#mistRetry').disabled = !list.length;
  const box = $('#mistList');
  box.innerHTML = '';
  list.forEach((m) => box.append(h('div', { class: 'card mist' },
    h('div', { class: 'row between' }, h('span', { class: 'tag accent' }, m.q.cat), h('span', { class: 'small muted' }, `missed ${m.wrong}× · ${new Date(m.t).toLocaleDateString()}`)),
    h('b', {}, m.q.q),
    h('div', { class: 'ans' }, m.choice >= 0 && m.choice != null ? h('span', { class: 'yours' }, `You said: ${m.q.options[m.choice]} · `) : h('span', { class: 'yours' }, 'Timed out · '), h('span', { class: 'right' }, `Answer: ${m.q.options[m.q.answer]}`)),
    m.q.explain ? h('div', { class: 'small muted' }, m.q.explain) : null)));
}
function retryNext() {
  const box = $('#mistList');
  if (!retryQueue.length) { renderMistakes(); toast('Retry round finished'); return; }
  const q = retryQueue.shift();
  box.innerHTML = '';
  const card = h('div', { class: 'card play' });
  box.append(card);
  showQuestion(card, q, { timer: false, lifelines: false, meta: `retry · ${retryQueue.length} left after this`, onAnswer: (choice, ok, secs, assisted, after) => {
    S.answers.push({ t: Date.now(), id: q.id, cat: q.cat, ok, expected: null, rq: Math.round(qRating(S, q)), practice: true, choice });
    save();
    after.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn primary next-btn', onclick: retryNext }, retryQueue.length ? 'Next' : 'Finish')));
  } });
}
$('#mistRetry').onclick = () => { retryQueue = mistakes(S.answers).map((m) => byId(m.id)).filter(Boolean); retryNext(); };

/* ================= bank ================= */
CATS.forEach((c) => { $('#bCat').append(h('option', { value: c }, c)); $('#nCat').append(h('option', { value: c }, c)); });
for (let i = 0; i < 4; i++) $('#nOpts').append(h('div', { class: 'row' }, h('input', { type: 'radio', name: 'nAns', value: i, checked: i === 0, 'aria-label': `Option ${i + 1} is correct` }), h('input', { class: 'input grow', id: 'nO' + i, placeholder: `Option ${i + 1}`, 'aria-label': `Option ${i + 1}` })));
function renderBank() {
  const q = $('#bSearch').value.trim().toLowerCase(), c = $('#bCat').value, src = $('#bSrc').value;
  const list = pool.filter((x) => (!c || x.cat === c) && (!src || x.id.startsWith(src)) && (!q || x.q.toLowerCase().includes(q) || x.options.some((o) => o.toLowerCase().includes(q))));
  $('#bCount').textContent = `${list.length} of ${pool.length}`;
  const answered = {};
  S.answers.forEach((a) => { const o = answered[a.id] || (answered[a.id] = { n: 0, right: 0 }); o.n++; if (a.ok) o.right++; });
  const t = $('#bTable');
  t.innerHTML = '';
  t.append(h('tr', {}, ['Question', 'Answer', 'Category', 'Rating', 'You', ''].map((x) => h('th', {}, x))));
  list.slice(0, 300).forEach((x) => t.append(h('tr', {},
    h('td', {}, x.q), h('td', {}, x.options[x.answer]), h('td', {}, x.cat), h('td', { class: 'mono' }, Math.round(qRating(S, x))),
    h('td', { class: 'small' }, answered[x.id] ? `${answered[x.id].right}/${answered[x.id].n}` : '—'),
    h('td', {}, x.id.startsWith('b') ? '' : h('button', { class: 'btn ghost sm', 'aria-label': 'Delete question', onclick: () => { extra = extra.filter((y) => y !== x); saveExtra(); renderBank(); } }, '×')))));
}
['#bSearch'].forEach((s) => ($(s).oninput = renderBank));
['#bCat', '#bSrc'].forEach((s) => ($(s).onchange = renderBank));
$('#addQ').onsubmit = (e) => {
  e.preventDefault();
  const raw = { cat: $('#nCat').value, q: $('#nQ').value, options: [0, 1, 2, 3].map((i) => $('#nO' + i).value), answer: +$('input[name=nAns]:checked').value, explain: $('#nExplain').value, difficulty: +$('#nDiff').value };
  const r = importQuestions([raw], pool);
  if (!r.questions.length) { $('#nErr').textContent = r.rejected[0].errors.join('; '); return; }
  $('#nErr').textContent = '';
  extra.push(r.questions[0]); saveExtra(); renderBank();
  e.target.reset();
  toast('Question added to the pool');
};
$('#bImport').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { const r = importQuestions(await f.text(), pool); extra.push(...r.questions); saveExtra(); renderBank(); toast(`Imported ${r.questions.length}, skipped ${r.rejected.length}`); }
  catch { toast('That file is not valid JSON', 'err'); }
  e.target.value = '';
};
$('#bExport').onclick = () => download('trivia-questions.json', JSON.stringify(extra.filter((x) => x.id.startsWith('c') || x.id.startsWith('ai')).map((x) => ({ cat: x.cat, q: x.q, options: x.options, answer: x.answer, explain: x.explain, difficulty: rToD(x.rating) })), null, 2), 'application/json');

/* ================= stats ================= */
function renderStats() {
  const a = S.answers.filter((x) => !x.practice), right = a.filter((x) => x.ok).length;
  const avgSecs = a.filter((x) => x.secs).reduce((s, x, _, arr) => s + x.secs / arr.length, 0);
  $('#sKpis').innerHTML = [['Rating', `${Math.round(S.overall)} ± ${ratingBand(S)}`], ['Answered', a.length], ['Accuracy', a.length ? Math.round((100 * right) / a.length) + '%' : '—'], ['Avg time', avgSecs ? avgSecs.toFixed(1) + ' s' : '—'], ['Best streak', S.best], ['Daily streak', dailyStreak() + ' d']]
    .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const cal = calibration(a, 5), W = 300, H = 220, p = 30, X = (v) => p + v * (W - p - 10), Y = (v) => H - p - v * (H - p - 10);
  $('#calib').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Calibration chart"><line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="var(--line)" stroke-dasharray="4 4"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(0)}" stroke="var(--muted)"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(1)}" stroke="var(--muted)"/>${[0, 0.5, 1].map((v) => `<text x="${X(v)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--muted)">${v * 100}%</text><text x="${p - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="var(--muted)">${v * 100}%</text>`).join('')}${cal.filter((b) => b.n).map((b) => `<circle cx="${X(b.predicted)}" cy="${Y(b.actual)}" r="${4 + Math.min(10, Math.sqrt(b.n) * 1.5)}" fill="var(--accent)" opacity=".75"><title>predicted ${Math.round(b.predicted * 100)}%, actual ${Math.round(b.actual * 100)}% (${b.n} answers)</title></circle>`).join('')}<text x="${W / 2}" y="${H}" text-anchor="middle" font-size="10" fill="var(--muted)">predicted</text></svg>${a.length < 20 ? '<p class="small muted">Answer at least 20 questions for a meaningful picture.</p>' : ''}`;
  $('#byDiff').innerHTML = accuracyByDifficulty(a).map((d) => `<div class="cat-row"><span>Level ${d.d}</span><div class="bar"><span style="width:${(100 * d.right) / d.n}%"></span></div><b class="mono" style="text-align:right">${Math.round((100 * d.right) / d.n)}%</b></div><div class="small muted" style="margin:-4px 0 8px 118px">${d.right}/${d.n}</div>`).join('') || '<div class="empty">No answers yet.</div>';
}
$('#reset').onclick = () => { if (!confirm('Reset your rating, history and daily results?')) return; S = newPlayer(); daily = {}; save(); saveDaily(); renderSide(); renderStats(); next(); };

/* ================= boot ================= */
Router.on('play', () => { if (!cur || $('#play')._done?.()) next(); });
Router.on('daily', renderDaily);
Router.on('mistakes', () => { retryQueue = []; renderMistakes(); });
Router.on('bank', renderBank);
Router.on('stats', renderStats);
renderSide();
next();

/* ================= AI command box ================= */
Copilot.register({
  context: () => `Category: ${cat}. Rating ${Math.round(S.overall)} ± ${ratingBand(S)}, ${S.n} answered, streak ${S.streak}. ${cur && Router.current === 'play' ? `Current question (${cur.cat}): ${cur.q} Options: ${cur.options.map((o, i) => `${i + 1}) ${o}`).join(' ')}. Answered: ${!!$('#play')._done?.()}` : ''} Categories: ${CATS.join(', ')}.`,
  actions: [
    { name: 'set_category', description: 'Play only one category (or Mixed) and show the next question', params: { category: ['Mixed', ...CATS].join(' | ') },
      run: ({ category }) => { const c = ['Mixed', ...CATS].find((x) => x.toLowerCase() === String(category).toLowerCase()); if (!c) throw new Error('Categories: Mixed, ' + CATS.join(', ')); cat = c; $$('#cats .btn').forEach((b) => b.classList.toggle('on', b.textContent === c)); Router.go('play'); next(); return `Playing ${c}: ${cur ? cur.q : 'no questions left'}`; } },
    { name: 'next_question', description: 'Skip to the next question', params: {}, run: () => { Router.go('play'); next(); return cur ? cur.q : 'No questions left'; } },
    { name: 'answer', description: 'Answer the current question on the Play page with an option number (1-4) or its text', params: { choice: 'option number 1-4 or the option text' },
      run: ({ choice }) => { const box = $('#play'); if (!cur || box._done()) throw new Error('No open question'); let i = cur.options.findIndex((o) => o.toLowerCase() === String(choice).toLowerCase()); if (i < 0) i = +choice - 1; if (!(i >= 0 && i < 4)) throw new Error('Pick 1-4'); box._answer(i); return i === cur.answer ? 'Correct' : `Wrong, the answer was ${cur.options[cur.answer]}`; } },
    { name: 'add_question', description: 'Add a multiple-choice question to the bank. Write it yourself: accurate, unambiguous, one correct option and three plausible distractors.', params: { category: CATS.join(' | '), question: 'question text', options: 'array of exactly 4 strings', answer: 'index 0-3 of the correct option', explain: 'one sentence explanation', difficulty: '1-10' },
      run: ({ category, question, options, answer, explain, difficulty }) => { const r = importQuestions([{ cat: CATS.find((c) => c.toLowerCase() === String(category).toLowerCase()) || category, q: question, options, answer: +answer, explain, difficulty: +difficulty || 5 }], pool); if (!r.questions.length) throw new Error(r.rejected[0].errors.join('; ')); extra.push(r.questions[0]); saveExtra(); if (Router.current === 'bank') renderBank(); return `Added "${question}" to ${category}`; } },
    { name: 'start_daily', description: 'Open today\'s daily ten', params: {}, run: () => { Router.go('daily'); return 'Opened the daily ten'; } },
    { name: 'retry_mistakes', description: 'Start a retry round of questions answered wrongly', params: {}, run: () => { Router.go('mistakes'); retryQueue = mistakes(S.answers).map((m) => byId(m.id)).filter(Boolean); const n = retryQueue.length; retryNext(); return n ? `Retrying ${n} questions` : 'No mistakes to retry'; } },
    { name: 'search_bank', description: 'Search the question bank', params: { text: 'search text', category: 'optional category' }, run: ({ text, category }) => { Router.go('bank'); $('#bSearch').value = text || ''; $('#bCat').value = CATS.find((c) => c.toLowerCase() === String(category || '').toLowerCase()) || ''; renderBank(); return $('#bCount').textContent; } },
    { name: 'my_stats', query: true, description: 'Look up rating, accuracy and answer counts overall and per category', params: {},
      run: () => { const a = S.answers.filter((x) => !x.practice); return JSON.stringify({ overall: Math.round(S.overall), band: ratingBand(S), answered: a.length, accuracy: a.length ? Math.round((100 * a.filter((x) => x.ok).length) / a.length) : null, bestStreak: S.best, categories: CATS.map((c) => { const xs = a.filter((x) => x.cat === c); return { c, rating: S.cats[c] ? Math.round(S.cats[c].r) : null, answered: xs.length, accuracy: xs.length ? Math.round((100 * xs.filter((x) => x.ok).length) / xs.length) : null }; }), outstandingMistakes: mistakes(S.answers).length }); } },
  ],
});
