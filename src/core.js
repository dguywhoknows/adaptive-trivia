/* core.js — the question bank, Elo ratings with an uncertainty band, adaptive selection, daily sets and calibration stats (pure, unit-tested). */

var CATS = ['Science', 'History', 'Geography', 'Technology', 'Arts', 'Sports'];
function dToR(d) { return 700 + Math.max(1, Math.min(10, d)) * 130; }
function rToD(r) { return Math.max(1, Math.min(10, Math.round((r - 700) / 130))); }
var BANK = [
  ['Science', 'Which gas do plants absorb from the air for photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1, 'Plants take in CO₂ and release O₂.', 2],
  ['Science', 'What is the chemical symbol for gold?', ['Gd', 'Go', 'Au', 'Ag'], 2, 'Au comes from the Latin "aurum". Ag is silver.', 3],
  ['Science', 'Which organelle is known as the powerhouse of the cell?', ['Nucleus', 'Ribosome', 'Golgi body', 'Mitochondria'], 3, 'Mitochondria produce most of the cell’s ATP.', 1],
  ['Science', 'Which subatomic particle has no electric charge?', ['Proton', 'Electron', 'Neutron', 'Positron'], 2, 'Neutrons are electrically neutral.', 3],
  ['Science', 'What is the most abundant gas in Earth’s atmosphere?', ['Oxygen', 'Nitrogen', 'Argon', 'Carbon dioxide'], 1, 'Nitrogen makes up about 78% of the atmosphere.', 4],
  ['Science', 'Roughly how fast does light travel in a vacuum?', ['300,000 km/s', '30,000 km/s', '3,000,000 km/s', '343 m/s'], 0, 'About 299,792 km/s. 343 m/s is the speed of sound in air.', 5],
  ['Science', 'Which element has atomic number 26?', ['Copper', 'Iron', 'Nickel', 'Zinc'], 1, 'Iron (Fe) has 26 protons.', 6],
  ['History', 'In which year did the Berlin Wall fall?', ['1985', '1989', '1991', '1993'], 1, 'It fell on 9 November 1989.', 4],
  ['History', 'Who was the first emperor of Rome?', ['Julius Caesar', 'Nero', 'Augustus', 'Caligula'], 2, 'Augustus became the first emperor in 27 BC. Julius Caesar was dictator, not emperor.', 5],
  ['History', 'In which year was the Magna Carta sealed?', ['1066', '1215', '1348', '1492'], 1, 'King John sealed it at Runnymede in 1215.', 6],
  ['History', 'Which civilization built Machu Picchu?', ['Aztec', 'Maya', 'Inca', 'Olmec'], 2, 'The Inca built it in the 15th century.', 3],
  ['History', 'Which ship sank in 1912 after striking an iceberg?', ['Lusitania', 'Titanic', 'Britannic', 'Olympic'], 1, 'RMS Titanic sank on 15 April 1912.', 1],
  ['History', 'Who was the first woman to win a Nobel Prize?', ['Ada Lovelace', 'Rosalind Franklin', 'Marie Curie', 'Florence Nightingale'], 2, 'Marie Curie shared the 1903 Nobel Prize in Physics.', 4],
  ['History', 'The Peace of Westphalia (1648) ended which conflict?', ['The Hundred Years’ War', 'The Thirty Years’ War', 'The War of the Roses', 'The Seven Years’ War'], 1, 'It ended the Thirty Years’ War in the Holy Roman Empire.', 8],
  ['Geography', 'What is the capital of Australia?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2, 'Canberra was purpose-built as a compromise between Sydney and Melbourne.', 4],
  ['Geography', 'What is the longest river in Africa?', ['Congo', 'Niger', 'Zambezi', 'Nile'], 3, 'The Nile is about 6,650 km long.', 2],
  ['Geography', 'Which country has the most natural lakes?', ['Russia', 'Canada', 'Finland', 'USA'], 1, 'Canada has more lakes than the rest of the world combined, by most counts.', 7],
  ['Geography', 'Mount Kilimanjaro is located in which country?', ['Kenya', 'Uganda', 'Tanzania', 'Ethiopia'], 2, 'It is in northeastern Tanzania, near the Kenyan border.', 5],
  ['Geography', 'What is the largest hot desert in the world?', ['Gobi', 'Kalahari', 'Arabian', 'Sahara'], 3, 'The Sahara covers about 9 million km². (Antarctica is the largest cold desert.)', 3],
  ['Geography', 'What is the capital of Kazakhstan?', ['Almaty', 'Astana', 'Tashkent', 'Bishkek'], 1, 'Astana (renamed Nur-Sultan 2019–2022) is the capital. Almaty is the largest city.', 8],
  ['Technology', 'What does CPU stand for?', ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Peripheral Unit'], 0, 'The CPU executes program instructions.', 1],
  ['Technology', 'Who is credited with inventing the World Wide Web?', ['Bill Gates', 'Tim Berners-Lee', 'Vint Cerf', 'Linus Torvalds'], 1, 'He proposed it at CERN in 1989.', 4],
  ['Technology', 'In which year was the first iPhone released?', ['2005', '2007', '2008', '2010'], 1, 'It launched in June 2007.', 4],
  ['Technology', 'Guido van Rossum created which programming language?', ['Ruby', 'Perl', 'Python', 'Java'], 2, 'Python first appeared in 1991.', 3],
  ['Technology', 'What does the "S" in HTTPS stand for?', ['Simple', 'Secure', 'Server', 'Session'], 1, 'HTTP Secure: HTTP over TLS.', 2],
  ['Technology', 'Which of these sorts is in-place, O(n log n) on average, and not stable?', ['Merge sort', 'Quicksort', 'Bubble sort', 'Insertion sort'], 1, 'Merge sort is stable but not in-place. Bubble and insertion sort are O(n²).', 8],
  ['Arts', 'Who painted the Mona Lisa?', ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'], 2, 'Leonardo painted it in the early 1500s.', 1],
  ['Arts', 'Which composer wrote the "Moonlight Sonata"?', ['Mozart', 'Beethoven', 'Chopin', 'Bach'], 1, 'Beethoven’s Piano Sonata No. 14 (1801).', 4],
  ['Arts', 'In which novel does Atticus Finch appear?', ['The Great Gatsby', 'Of Mice and Men', 'To Kill a Mockingbird', 'Catch-22'], 2, 'Harper Lee, 1960.', 4],
  ['Arts', 'Who painted "The Persistence of Memory"?', ['René Magritte', 'Salvador Dalí', 'Joan Miró', 'Max Ernst'], 1, 'The melting clocks, 1931.', 5],
  ['Arts', 'How many symphonies did Beethoven complete?', ['7', '9', '10', '12'], 1, 'His Ninth includes the "Ode to Joy".', 6],
  ['Sports', 'How many players does each team have on the field in soccer?', ['9', '10', '11', '12'], 2, 'Eleven, including the goalkeeper.', 1],
  ['Sports', 'Which country has won the most FIFA World Cups?', ['Germany', 'Italy', 'Argentina', 'Brazil'], 3, 'Brazil has five titles.', 3],
  ['Sports', 'In tennis, what is a score of zero called?', ['Nil', 'Love', 'Duck', 'Zero'], 1, '"Love" is tennis for zero.', 2],
  ['Sports', 'Who has won the most Olympic gold medals?', ['Usain Bolt', 'Michael Phelps', 'Carl Lewis', 'Larisa Latynina'], 1, 'Michael Phelps has 23 golds.', 4],
  ['Science', 'What is the hardest natural mineral?', ['Quartz', 'Topaz', 'Diamond', 'Corundum'], 2, 'Diamond scores 10 on the Mohs scale.', 2],
  ['Science', 'Which planet has the shortest year?', ['Venus', 'Mercury', 'Mars', 'Earth'], 1, 'Mercury orbits the Sun in about 88 days.', 3],
  ['Science', 'What is the pH of pure water at 25 °C?', ['5', '6', '7', '8'], 2, 'Pure water is neutral, pH 7.', 2],
  ['Science', 'Which scientist proposed the three laws of motion?', ['Galileo', 'Kepler', 'Newton', 'Einstein'], 2, 'Newton published them in the Principia (1687).', 2],
  ['Science', 'What is the SI unit of electrical resistance?', ['Volt', 'Ohm', 'Ampere', 'Watt'], 1, 'Resistance is measured in ohms (Ω).', 4],
  ['Science', 'Which blood type is the universal red-cell donor?', ['AB positive', 'A negative', 'O negative', 'B positive'], 2, 'O negative red cells lack A, B and RhD antigens.', 6],
  ['Science', 'What is the half-life of carbon-14, to the nearest thousand years?', ['1,000', '5,700', '12,000', '50,000'], 1, 'About 5,730 years, which is why it dates objects up to ~50,000 years old.', 8],
  ['History', 'Which empire was ruled by Suleiman the Magnificent?', ['Mughal', 'Ottoman', 'Safavid', 'Byzantine'], 1, 'He ruled the Ottoman Empire from 1520 to 1566.', 6],
  ['History', 'In which city was Archduke Franz Ferdinand assassinated in 1914?', ['Vienna', 'Belgrade', 'Sarajevo', 'Budapest'], 2, 'The assassination in Sarajevo triggered the July Crisis.', 5],
  ['History', 'Who was the first person to walk on the Moon?', ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'Michael Collins'], 2, 'Armstrong stepped onto the Moon on 20 July 1969.', 1],
  ['History', 'Which pharaoh’s nearly intact tomb was found by Howard Carter in 1922?', ['Ramesses II', 'Tutankhamun', 'Khufu', 'Akhenaten'], 1, 'Tutankhamun’s tomb, KV62, in the Valley of the Kings.', 3],
  ['History', 'The Meiji Restoration took place in which country?', ['China', 'Korea', 'Japan', 'Vietnam'], 2, 'It restored imperial rule in Japan in 1868.', 6],
  ['Geography', 'Which is the smallest country in the world by area?', ['Monaco', 'Vatican City', 'San Marino', 'Nauru'], 1, 'Vatican City covers about 0.44 km².', 2],
  ['Geography', 'Through how many countries does the Danube flow?', ['6', '8', '10', '12'], 2, 'Ten countries, more than any other river.', 9],
  ['Geography', 'What is the capital of Canada?', ['Toronto', 'Montreal', 'Vancouver', 'Ottawa'], 3, 'Ottawa, in Ontario.', 2],
  ['Geography', 'Which strait separates Europe from Africa at its narrowest?', ['Bosporus', 'Strait of Gibraltar', 'Strait of Hormuz', 'Bab-el-Mandeb'], 1, 'Gibraltar is about 14 km wide at its narrowest.', 4],
  ['Geography', 'Lake Titicaca lies on the border of Peru and which country?', ['Chile', 'Bolivia', 'Ecuador', 'Argentina'], 1, 'It straddles Peru and Bolivia.', 5],
  ['Technology', 'What does "RAM" stand for?', ['Random Access Memory', 'Read Access Module', 'Rapid Application Memory', 'Runtime Allocation Map'], 0, 'RAM is volatile working memory.', 1],
  ['Technology', 'Which company created the Java programming language?', ['Microsoft', 'Sun Microsystems', 'IBM', 'Oracle'], 1, 'Sun released Java in 1995; Oracle acquired Sun in 2010.', 5],
  ['Technology', 'How many bits are in a byte?', ['4', '8', '16', '32'], 1, 'A byte is 8 bits on virtually all modern systems.', 1],
  ['Technology', 'Which data structure uses first-in, first-out order?', ['Stack', 'Queue', 'Tree', 'Heap'], 1, 'A queue is FIFO; a stack is LIFO.', 3],
  ['Technology', 'What is the time complexity of binary search on a sorted array?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 1, 'Each step halves the search range.', 5],
  ['Technology', 'In networking, which port does HTTPS use by default?', ['80', '21', '443', '8080'], 2, 'HTTP uses 80, HTTPS 443.', 6],
  ['Arts', 'Which playwright wrote "Waiting for Godot"?', ['Harold Pinter', 'Samuel Beckett', 'Arthur Miller', 'Tom Stoppard'], 1, 'Beckett wrote it in French first (1953).', 6],
  ['Arts', 'Which artist cut off part of his own ear?', ['Paul Gauguin', 'Claude Monet', 'Vincent van Gogh', 'Edgar Degas'], 2, 'Van Gogh, in Arles, December 1888.', 2],
  ['Arts', 'Who wrote "One Hundred Years of Solitude"?', ['Jorge Luis Borges', 'Gabriel García Márquez', 'Isabel Allende', 'Mario Vargas Llosa'], 1, 'García Márquez, 1967.', 5],
  ['Arts', 'Which instrument family does the oboe belong to?', ['Brass', 'Strings', 'Woodwind', 'Percussion'], 2, 'The oboe is a double-reed woodwind.', 3],
  ['Arts', 'What architectural style is Notre-Dame de Paris?', ['Baroque', 'Romanesque', 'Gothic', 'Neoclassical'], 2, 'French Gothic, with flying buttresses.', 4],
  ['Sports', 'How long is a marathon, in kilometres (approximately)?', ['26.2', '40', '42.2', '50'], 2, '42.195 km, or 26.2 miles.', 3],
  ['Sports', 'In which sport would you perform a "slam dunk"?', ['Volleyball', 'Basketball', 'Handball', 'Tennis'], 1, 'Basketball.', 1],
  ['Sports', 'Which country hosted the 2016 Summer Olympics?', ['China', 'United Kingdom', 'Brazil', 'Japan'], 2, 'Rio de Janeiro, Brazil.', 3],
  ['Sports', 'How many points is a touchdown worth in American football (before the extra point)?', ['3', '6', '7', '2'], 1, 'Six, followed by a try for one or two more.', 3],
  ['Sports', 'Which golfer has won the most men’s major championships?', ['Tiger Woods', 'Jack Nicklaus', 'Arnold Palmer', 'Gary Player'], 1, 'Jack Nicklaus won 18 majors.', 7]
].map(function (x, i) { return { id: 'b' + i, cat: x[0], q: x[1], options: x[2], answer: x[3], explain: x[4], rating: dToR(x[5]) }; });

/* ---------- ratings ---------- */
function expectScore(rp, rq) { return 1 / (1 + Math.pow(10, (rq - rp) / 400)); }
function newPlayer() { return { overall: 1200, rd: 350, cats: {}, n: 0, history: [1200], qs: {}, seen: [], streak: 0, best: 0, answers: [] }; }
function qRating(state, q) { return state.qs[q.id] != null ? state.qs[q.id] : q.rating; }
function catRating(state, c) { return state.cats[c] ? state.cats[c].r : state.overall; }
/*
 * Score an answer. score: 1 correct, 0.6 correct with a lifeline, 0 wrong or timed out.
 * K shrinks as the rating deviation (rd) shrinks, so early answers move the rating fast and later ones settle it.
 * The question's own rating moves the other way, so the bank calibrates itself.
 */
function applyAnswer(state, q, correct, opts) {
  opts = opts || {};
  var s = correct ? (opts.assisted ? 0.6 : 1) : 0, rq = qRating(state, q), before = state.overall;
  var K = Math.max(16, Math.min(48, (state.rd || 350) / 7));
  var c = state.cats[q.cat] || (state.cats[q.cat] = { r: state.overall, n: 0, right: 0 });
  var expected = expectScore(before, rq);
  c.r += K * (s - expectScore(c.r, rq)); c.n++; if (correct) c.right++;
  state.overall += K * (s - expected);
  state.rd = Math.max(60, Math.round((state.rd || 350) * 0.94));
  if (!opts.practice) state.qs[q.id] = rq + 16 * ((1 - s) - expectScore(rq, before));
  state.n++;
  if (state.seen.indexOf(q.id) < 0) state.seen.push(q.id);
  state.streak = correct ? state.streak + 1 : 0;
  state.best = Math.max(state.best, state.streak);
  state.history.push(Math.round(state.overall));
  if (state.history.length > 200) state.history.shift();
  state.answers.push({ t: opts.t || Date.now(), id: q.id, cat: q.cat, ok: !!correct, expected: +expected.toFixed(3), rq: Math.round(rq), assisted: !!opts.assisted, secs: opts.secs, daily: opts.daily || null, choice: opts.choice });
  if (state.answers.length > 2000) state.answers.shift();
  return { delta: state.overall - before, expected: expected };
}
/* 95% band shown next to the rating. */
function ratingBand(state) { return Math.round(1.96 * (state.rd || 350) / 2); }

/* ---------- selection ---------- */
function unseen(pool, state, cat) { return pool.filter(function (q) { return (cat === 'Mixed' || q.cat === cat) && state.seen.indexOf(q.id) < 0; }); }
/* Aim for roughly a 60% success chance: target rating sits a little below the player's. Picks among the 3 closest. */
function pickQuestion(pool, state, cat, rand) {
  rand = rand || Math.random;
  var target = (cat === 'Mixed' ? state.overall : catRating(state, cat)) - 70;
  var cs = unseen(pool, state, cat).sort(function (a, b) { return Math.abs(qRating(state, a) - target) - Math.abs(qRating(state, b) - target) || (a.id < b.id ? -1 : 1); });
  if (!cs.length) return null;
  return cs[Math.floor(rand() * Math.min(3, cs.length))];
}

/* ---------- daily challenge ---------- */
function hashString(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* Ten built-in questions for a date, the same for every player, sorted easy to hard, at most two per category. */
function dailySet(bank, day, n) {
  n = n || 10;
  var r = seeded(hashString('daily:' + day)), shuffled = bank.slice();
  for (var i = shuffled.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
  var per = {}, out = [];
  shuffled.forEach(function (q) { if (out.length < n && (per[q.cat] || 0) < 2) { per[q.cat] = (per[q.cat] || 0) + 1; out.push(q); } });
  return out.sort(function (a, b) { return a.rating - b.rating; });
}
function dailyShareText(day, results) {
  var right = results.filter(Boolean).length;
  return 'Trivia daily ' + day + ': ' + right + '/' + results.length + '\n' + results.map(function (ok) { return ok ? '■' : '□'; }).join('');
}

/* ---------- stats ---------- */
/* Predicted vs actual success, bucketed by predicted chance. A well-calibrated model sits on the diagonal. */
function calibration(answers, buckets) {
  buckets = buckets || 5;
  var b = []; for (var i = 0; i < buckets; i++) b.push({ lo: i / buckets, hi: (i + 1) / buckets, n: 0, right: 0, predicted: 0 });
  answers.forEach(function (a) { if (a.expected == null) return; var k = Math.min(buckets - 1, Math.floor(a.expected * buckets)); b[k].n++; b[k].right += a.ok ? 1 : 0; b[k].predicted += a.expected; });
  return b.map(function (x) { return { lo: x.lo, hi: x.hi, n: x.n, actual: x.n ? x.right / x.n : null, predicted: x.n ? x.predicted / x.n : null }; });
}
function accuracyByDifficulty(answers) {
  var out = {};
  answers.forEach(function (a) { var d = rToD(a.rq); var o = out[d] || (out[d] = { d: d, n: 0, right: 0 }); o.n++; if (a.ok) o.right++; });
  return Object.keys(out).map(function (k) { return out[k]; }).sort(function (x, y) { return x.d - y.d; });
}
/* Questions answered wrong at least once and not answered right since. */
function mistakes(answers) {
  var last = {};
  answers.forEach(function (a) { last[a.id] = last[a.id] ? { wrong: last[a.id].wrong + (a.ok ? 0 : 1), ok: a.ok, t: a.t, choice: a.choice } : { wrong: a.ok ? 0 : 1, ok: a.ok, t: a.t, choice: a.choice }; });
  return Object.keys(last).filter(function (id) { return last[id].wrong > 0 && !last[id].ok; }).map(function (id) { return { id: id, wrong: last[id].wrong, t: last[id].t, choice: last[id].choice }; }).sort(function (a, b) { return b.t - a.t; });
}

/* ---------- custom questions ---------- */
function validateQuestion(q) {
  var errs = [];
  if (!q || typeof q.q !== 'string' || q.q.trim().length < 8) errs.push('question text is too short');
  if (!q || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(function (o) { return !String(o || '').trim(); })) errs.push('needs exactly four non-empty options');
  else if (new Set(q.options.map(function (o) { return String(o).trim().toLowerCase(); })).size !== 4) errs.push('options must be different');
  if (!q || !(q.answer >= 0 && q.answer <= 3) || Math.floor(q.answer) !== +q.answer) errs.push('answer must be 0-3');
  if (!q || CATS.indexOf(q.cat) < 0) errs.push('category must be one of ' + CATS.join(', '));
  return errs;
}
function importQuestions(json, existing) {
  var data = typeof json === 'string' ? JSON.parse(json) : json, list = Array.isArray(data) ? data : data.questions || [];
  var have = {}; existing.forEach(function (q) { have[q.q.trim().toLowerCase()] = 1; });
  var ok = [], rejected = [];
  list.forEach(function (raw, i) {
    var q = { cat: raw.cat || raw.category, q: raw.q || raw.question, options: raw.options, answer: +raw.answer, explain: raw.explain || '', difficulty: +raw.difficulty || 5 };
    var errs = validateQuestion(q);
    if (!errs.length && have[q.q.trim().toLowerCase()]) errs.push('duplicate');
    if (errs.length) { rejected.push({ index: i, errors: errs }); return; }
    have[q.q.trim().toLowerCase()] = 1;
    ok.push({ id: 'c' + hashString(q.q).toString(36), cat: q.cat, q: q.q.trim(), options: q.options.map(function (o) { return String(o).trim(); }), answer: q.answer, explain: q.explain, rating: dToR(q.difficulty) });
  });
  return { questions: ok, rejected: rejected };
}
