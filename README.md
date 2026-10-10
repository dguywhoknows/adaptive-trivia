# adaptive-trivia

[![tests](https://github.com/dguywhoknows/adaptive-trivia/actions/workflows/tests.yml/badge.svg)](https://github.com/dguywhoknows/adaptive-trivia/actions/workflows/tests.yml)

Adaptive AI trivia where questions and players both carry Elo ratings, so every question lands at the edge of what you know.

Live: https://dguywhoknows.github.io/adaptive-trivia/

## Overview

Trivia Elo matches you with questions the way chess servers match opponents. You have an overall rating and one per category, and every question has its own rating too. Each answer updates both sides with the Elo formula, so the question bank calibrates itself from real play. The picker aims for a ~60% expected win rate to keep you in the flow zone. When good matches run low, the AI generates fresh, non-repeating questions near your level in the background. A built-in bank of 36 hand-checked questions lets it work fully offline.

## Pages

- **Play**
- **Daily**
- **Mistakes**
- **Question bank**
- **Stats**
- **Settings**

## Features

- Dual Elo: per-player (overall + per-category) and per-question ratings, both updated every answer
- Target-difficulty picker that aims for ~60% success with a little randomness
- Background AI question generation near your rating, de-duplicated against the pool
- 20-second timer, keyboard play (1-4, Enter), streaks
- Lifelines: 50:50 and an AI hint that nudges without revealing (assisted answers earn less rating)
- Rating-history sparkline and per-category ratings with accuracy
- 36-question offline bank for demo mode
- Rating uncertainty: a deviation that shrinks with every answer drives the K-factor and is shown as a ± band, so new players calibrate quickly and settled ratings stay stable
- Daily page: the same ten built-in questions for everyone each day (seeded by the date, at most two per category, easiest first), one attempt, a day streak and a copyable result
- Mistakes page: every question you have not yet answered correctly, with your answer and the right one, plus a retry round that does not affect your rating
- Question bank page: browse and search all questions with their live ratings and your record; add your own with validation; import and export JSON
- Stats page: calibration chart (predicted vs actual success), accuracy by difficulty level, average answer time and streaks
- 68 built-in questions across six categories

## How it works

LLM calls are used for:

- Difficulty-targeted question generation (JSON) with answer shuffling and validation
- Non-revealing hint generation

Everything else (Elo math, matchmaking, timer, scoring, persistence, charts) runs locally in the browser.

## Getting started

No build step and no dependencies. Serve the folder with any static server:

```bash
git clone https://github.com/dguywhoknows/adaptive-trivia.git
cd adaptive-trivia
python -m http.server 8000
```

Then open http://localhost:8000.

`index.html` is the public home page, `login.html` handles accounts and `app.html` is the app.

### Telling the app what to do

Every page has an **Ask AI** box (Ctrl/Cmd+K). Type a request in plain words and the model plans a sequence of
calls to the app's own functions, runs them and reports back. The **Instructions** tab stores standing
preferences that are added to every AI request the app makes.

### Configuration

`src/lib/config.js` is generated from the build settings: the Supabase project (accounts) and the AI proxy URL.
Signed-in users get the built-in AI through the proxy, which keeps the provider key as a server-side secret.
Without those settings the app runs for guests, in demo mode, or with a personal [Groq](https://console.groq.com/keys)
or [OpenRouter](https://openrouter.ai/keys) key entered under **Settings → Model provider** (stored only in this
browser and sent only to that provider).

## Testing

`src/core.js` holds the app's logic as pure functions and is covered by 8 unit tests.

```bash
node tests/run-node.js        # CI runs this on every push
```

Or open `tests/index.html` in a browser ([live](https://dguywhoknows.github.io/adaptive-trivia/tests/)).

## Project structure

```
index.html           public home page (generated)
login.html           sign-in and sign-up (generated)
app.html             the app: markup for every page
src/app.js           UI, page wiring and event handlers
src/core.js          pure logic with no DOM access (unit-tested)
src/lib/ai.js        LLM client: Groq / OpenRouter, streaming, JSON mode, retries
src/lib/dom.js       DOM helpers, namespaced storage, markdown renderer
src/lib/router.js    hash router and the Settings page
src/lib/copilot.js   AI command box that drives the app's own functions
src/lib/auth.js      accounts (Supabase Auth) and the sign-in gate
styles/base.css      design tokens and shared components
styles/app.css       app-specific styles
tests/               unit tests (browser runner + Node runner for CI)
```

## Tech

- Elo rating system (K-factor schedule, expected-score model)
- Self-calibrating item difficulty
- SVG sparkline
- Elo maths, selection, daily sets, calibration and question validation in src/core.js covered by unit tests run in the browser and in CI
- Vanilla JavaScript, no framework or bundler
- Deployed with GitHub Pages

## License

MIT
