const Q = (id, rating, cat = 'Science') => ({ id, cat, q: 'Question ' + id, options: ['a', 'b', 'c', 'd'], answer: 0, rating });

test('the built-in bank is valid and covers every category', () => {
  assert.ok(BANK.length >= 60);
  BANK.forEach((q) => assert.deepEq(validateQuestion(q), [], q.q));
  assert.eq(new Set(BANK.map((q) => q.id)).size, BANK.length);
  CATS.forEach((c) => assert.ok(BANK.filter((q) => q.cat === c).length >= 8, c));
  assert.eq(dToR(1), 830); assert.eq(rToD(1500), 6); assert.eq(rToD(9999), 10);
});

test('expectScore follows the Elo curve', () => {
  assert.eq(expectScore(1200, 1200), 0.5);
  assert.near(expectScore(1400, 1200), 0.7597, 1e-4);
  assert.near(expectScore(1200, 1400) + expectScore(1400, 1200), 1, 1e-12);
});

test('applyAnswer moves player and question ratings in opposite directions', () => {
  const s = newPlayer(), q = Q('x', 1200);
  const r = applyAnswer(s, q, true, { t: 1 });
  assert.eq(r.delta, 24);
  assert.eq(s.qs.x, 1192);
  assert.eq(s.rd, 329);
  assert.deepEq([s.n, s.streak, s.cats.Science.right, s.answers[0].ok, s.answers[0].expected], [1, 1, 1, true, 0.5]);
  const t = newPlayer();
  assert.near(applyAnswer(t, q, true, { assisted: true }).delta, 4.8, 1e-9);
  const u = newPlayer();
  assert.eq(applyAnswer(u, q, false).delta, -24);
  assert.eq(u.streak, 0);
});

test('the rating settles as the deviation shrinks', () => {
  const s = newPlayer();
  for (let i = 0; i < 60; i++) applyAnswer(s, Q('q' + i, 1200), i % 2 === 0);
  assert.eq(s.rd, 60);
  const before = s.overall;
  assert.near(applyAnswer(s, Q('z', Math.round(before)), true).delta, 8, 0.1, 'K floor of 16 at even odds');
  assert.eq(ratingBand(newPlayer()), 343);
  assert.eq(s.best, 1);
});

test('pickQuestion targets slightly below the player and skips seen questions', () => {
  const pool = [Q('easy', 900), Q('near', 1120), Q('hard', 1600), Q('hist', 1130, 'History')];
  const s = newPlayer();
  assert.eq(pickQuestion(pool, s, 'Science', () => 0).id, 'near');
  assert.eq(pickQuestion(pool, s, 'Mixed', () => 0).id, 'hist');
  s.seen.push('near');
  assert.eq(pickQuestion(pool, s, 'Science', () => 0).id, 'easy');
  assert.eq(pickQuestion(pool, s, 'Arts', () => 0), null);
});

test('dailySet is deterministic, balanced and ordered by difficulty', () => {
  const a = dailySet(BANK, '2026-10-08'), b = dailySet(BANK, '2026-10-08');
  assert.deepEq(a.map((q) => q.id), b.map((q) => q.id));
  assert.eq(a.length, 10);
  const per = {};
  a.forEach((q) => (per[q.cat] = (per[q.cat] || 0) + 1));
  assert.ok(Object.values(per).every((n) => n <= 2));
  assert.ok(a.every((q, i) => !i || a[i - 1].rating <= q.rating));
  assert.ok(dailySet(BANK, '2026-10-09').map((q) => q.id).join() !== a.map((q) => q.id).join());
  assert.eq(dailyShareText('2026-10-08', [true, false, true]), 'Trivia daily 2026-10-08: 2/3\n■□■');
});

test('calibration, accuracy by difficulty and mistakes', () => {
  const ans = [{ id: 'a', expected: 0.1, ok: false, rq: 1500, t: 1 }, { id: 'b', expected: 0.15, ok: true, rq: 1500, t: 2 }, { id: 'c', expected: 0.9, ok: true, rq: 900, t: 3 }, { id: 'a', expected: 0.2, ok: true, rq: 1500, t: 4 }, { id: 'd', expected: 0.5, ok: false, rq: 1200, t: 5 }];
  const cal = calibration(ans);
  assert.deepEq([cal[0].n, cal[0].actual], [2, 0.5]);
  assert.deepEq([cal[4].n, cal[4].actual], [1, 1]);
  assert.eq(cal[2].actual, 0);
  const acc = accuracyByDifficulty(ans);
  assert.deepEq(acc.map((x) => [x.d, x.n, x.right]), [[2, 1, 1], [4, 1, 0], [6, 3, 2]]);
  assert.deepEq(mistakes(ans).map((m) => m.id), ['d']);
});

test('importQuestions validates, dedupes and assigns stable ids', () => {
  const r = importQuestions(JSON.stringify({ questions: [
    { category: 'Science', question: 'What colour is chlorophyll mostly?', options: ['Red', 'Green', 'Blue', 'Yellow'], answer: 1, difficulty: 2 },
    { cat: 'Science', q: BANK[0].q, options: ['a', 'b', 'c', 'd'], answer: 0 },
    { cat: 'Science', q: 'Too few options here?', options: ['a', 'b'], answer: 0 },
    { cat: 'Cooking', q: 'Which herb is in pesto?', options: ['Basil', 'Mint', 'Dill', 'Sage'], answer: 0 },
  ] }), BANK);
  assert.eq(r.questions.length, 1);
  assert.eq(r.questions[0].rating, dToR(2));
  assert.ok(r.questions[0].id.startsWith('c'));
  assert.deepEq(r.rejected.map((x) => x.errors[0]), ['duplicate', 'needs exactly four non-empty options', 'category must be one of Science, History, Geography, Technology, Arts, Sports']);
  assert.deepEq(validateQuestion({ cat: 'Arts', q: 'Pick one of these', options: ['a', 'A', 'b', 'c'], answer: 0 }), ['options must be different']);
});
