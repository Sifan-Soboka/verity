# Verity — Financial decisions, made clearer.

Verity is a full-stack **educational loan-decision simulation** built for the CSIT305 project
*"Enhancing Customer Understanding of AI-Based Loan Approval Decisions."* Users enter a monthly
income, debt-to-income (DTI) ratio and credit score; the server calculates a demonstration decision,
stores it, and explains — in plain language and with charts — how each factor contributed.

> ### ⚠️ Academic disclaimer
> Verity is an academic demonstration, **not a real lending system**. It does not make or represent
> real lending decisions, any bank's credit policy, or any regulatory standard. Decisions come from a
> transparent, deterministic, documented scoring policy — not a trained machine-learning model — and
> the factor contributions are **not** SHAP or LIME values. Use fictional values only.

---

## Features

- **Landing page** with a worked example calculated live by the engine (report Scenario B).
- **Assessment form** — numeric inputs with ranges, examples, client- and server-side validation,
  loading state, idempotent submission (double-clicks never create duplicates), and one-click presets
  for the five report scenarios (A–E), which stay editable.
- **Results page** loaded from the API by application ID: outcome, application ID, submitted values,
  0–100 score track with threshold, diverging factor-contribution chart, "how the score adds up"
  arithmetic, plain-language explanation, three consistent factor cards, and — for rejections —
  calculated single-factor changes that would reach approval.
- **Dashboard** — totals, approvals, rejections, average score and outcome distribution, all computed
  from stored records; recent applications with links; empty state; clear history with confirmation.
- **Scenario check** — when submitted values match a report scenario, the results page shows whether
  the calculated outcome agrees with the report's intended outcome (it never uses that outcome).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · SQLite · Node's built-in
test runner (`node:test`) via `tsx`. Charts and icons are plain SVG/CSS — no extra UI libraries.

## Project structure

```
app/
  page.tsx                      Landing page
  apply/page.tsx                Assessment form page
  applications/[id]/page.tsx    Result page (fetches GET /api/applications/[id])
  dashboard/page.tsx            Dashboard & history
  api/applications/route.ts     POST · GET · DELETE  (thin wrappers)
  api/applications/[id]/route.ts GET one application
components/                     UI: layout, primitives, form, results, dashboard
lib/
  engine/policy.ts              ← ALL weights, reference points, threshold and limits
  engine/decision.ts            Deterministic decision engine
  explain/explanation.ts        Plain-language explanation engine
  validation/                   Input ranges + validation (shared by form and API)
  server/handlers.ts            API logic (validate → score → explain → save → respond)
  server/prismaRepository.ts    Prisma data access
  api/client.ts                 Browser API client
  scenarios.ts                  Report scenarios A–E (presets / test cases)
prisma/                         schema.prisma + migrations
tests/                          Automated tests
docs/DECISION_POLICY.md         Formula, worked examples, calibration notes
docs/API.md                     API reference
```

## Getting started

**Requirements:** Node.js **22.13 or newer** (the database tests use the built-in `node:sqlite`) and npm.

```bash
git clone <your-repo-url> verity
cd verity
npm install                 # also runs `prisma generate`
cp .env.example .env        # Windows: copy .env.example .env
npm run db:setup            # creates prisma/dev.db from the migrations
npm run dev                 # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

### Environment variables

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string (relative to `prisma/`). Never commit `.env`. |

### Database commands

| Command | What it does |
|---|---|
| `npm run db:setup` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:migrate` | Create a new migration after editing `schema.prisma` (`prisma migrate dev`) |
| `npm run db:reset` | Drop and recreate the database |
| `npm run db:studio` | Browse records in Prisma Studio |

Only the three financial values and calculated results are stored — no names or personal details.

## How decisions are calculated

```
score = 50 + income points + DTI points + credit-score points        (0–100)
Approved if score ≥ 50 and DTI ≤ 60%
```

| Factor | Reference (0 pts) | Max effect |
|---|---|---|
| Monthly income | AED 6,000 (full support at 15,000, full concern at 2,000) | ±10 |
| DTI ratio (lower is better) | 30% (full support at 10%, full concern at 70%) | ±14 |
| Credit score | 640 (full support at 800, full concern at 550) | ±26 |

Each value is normalised to −1…+1 between its anchors (piecewise-linear), multiplied by the factor's
maximum points and rounded to one decimal, so the contributions shown always add up to the score.
All five report scenarios reproduce the report's intended outcomes **without special-casing**:

| Scenario | Income | DTI | Credit | Score | Outcome |
|---|---:|---:|---:|---:|---|
| A | 15,000 | 18% | 790 | 92.8 | Approved |
| B | 10,000 | 35% | 720 | 65.6 | Approved |
| C | 8,000 | 48% | 690 | 54.0 | Approved (borderline) |
| D | 6,000 | 65% | 620 | 31.9 | Rejected (also above DTI limit) |
| E | 11,000 | 25% | 580 | 41.8 | Rejected |

An equal-weight policy got C and E wrong; the conflict, the adjustment and the 60% DTI limit are
explained in **[docs/DECISION_POLICY.md](docs/DECISION_POLICY.md)**. To change the policy, edit
`lib/engine/policy.ts` only.

## API

`POST /api/applications` · `GET /api/applications` · `GET /api/applications/{id}` ·
`DELETE /api/applications?confirm=true` — see **[docs/API.md](docs/API.md)**.

## Testing

```bash
npm test             # all automated tests
npm run typecheck    # TypeScript
```

| File | Covers |
|---|---|
| `tests/engine.test.ts` | normalisation, contributions, score arithmetic, threshold boundary, DTI limit, monotonicity, scenarios A–E, paths to approval |
| `tests/explanation.test.ts` | explanations use actual values, differ per applicant, list supporting/concern factors, borderline and DTI-limit wording, no SHAP/LIME claims |
| `tests/validation.test.ts` | empty, non-numeric, negative, zero, decimal, out-of-range, very large values, unexpected fields |
| `tests/api.test.ts` | status codes, response envelope, persistence, idempotent/duplicate submissions, database failure (500 without leaking details), history, clear |
| `tests/repository.test.ts` | database operations against a real SQLite database built from the Prisma migration SQL |
| `tests/prisma-repository.test.ts` | the same database contract through the real Prisma client (runs after `npm install`; skipped if the client isn't generated) |

## Migrating to PostgreSQL

The schema uses only portable types (`String`, `Float`, `Int`, `DateTime`).

1. In `prisma/schema.prisma` set `provider = "postgresql"`.
2. Set `DATABASE_URL` to your PostgreSQL URL.
3. Delete `prisma/migrations` (they are SQLite-specific) and run `npm run db:migrate -- --name init`.

Optionally switch `monthlyIncome`/`dtiRatio` to `Decimal` and `factorDetails`/`explanation` to `Json`.

## Known limitations

- The scoring policy is a hand-calibrated demonstration, fitted to five fictional scenarios; it is not
  validated against real lending data and ignores loan amount, term, expenses, employment, etc.
- It is additive: below the DTI limit, strong factors can offset weak ones. The 60% DTI limit is a
  hard cut-off.
- No authentication — anyone with access to a running instance can view and clear the history.
  Intended for local or classroom use.
- Contributions describe Verity's own formula; they are not SHAP/LIME attributions of a model.
- SQLite is suited to a single local instance; use PostgreSQL for shared deployments.

## Academic context

Built for CSIT305 (Group 2). The five scenarios and illustrative explanations come from the project
report, which studies whether plain-language explanations and visualisation improve customers'
understanding of AI-assisted loan decisions. Generative-AI assistance used in building this
application should be documented according to the university's requirements.
