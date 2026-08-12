# Financial Analyzer Platform

**Financial Statement Analysis & Business Valuation Platform**  
KFUPM Summer Training 2026 — Bayan Altharwah Financial Consultancy

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, React Router v6 |
| UI Components | AG Grid Community Edition, Recharts |
| State | React Context (via Outlet) + local useState |
| Backend | Python 3.11+, FastAPI |
| Data Processing | pandas, openpyxl, rapidfuzz |
| Database | Supabase (PostgreSQL + Realtime) |

---

## Project Structure

```
financial-analyzer-platform/
├── backend/              ← FastAPI backend
├── frontend/             ← React + Vite frontend
├── supabase/             ← SQL migrations and seed data
└── README.md
```

---

## Getting Started

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run every file in `supabase/migrations/` **in filename order**
   (the init migration alone is missing the `cash_flow_statement` column)
3. (Optional) Run `supabase/seed.sql` for demo data

### 2. Backend

```bash
cd backend

# Copy environment file and fill in your Supabase keys
cp .env.example .env

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the dev server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend

# Copy and fill in environment variables
cp .env.example .env

# Install dependencies (already done if you ran npm install)
npm install

# Start the dev server
npm run dev
```

App available at: http://localhost:5173

---

## Environment Variables

### Backend (`backend/.env`)
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key          # required — routes run under RLS
CORS_ORIGINS=http://localhost:5173
CORS_ORIGIN_REGEX=                       # optional, for Vercel preview deploys
```

`SUPABASE_SERVICE_ROLE_KEY` is **not required**: it bypasses RLS and its only
consumer (`get_db`) has no callers. Every route uses `get_user_db`.

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Deployment

Frontend on **Vercel**, backend on **Render**. They are separate deployments —
running one without the other gives a working page whose data calls all fail.

### Backend (Render)

`render.yaml` at the repo root is a Blueprint. In Render: **New > Blueprint**,
connect this repo, and it creates the service and prompts for the four values
marked `sync: false`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://<project-id>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase > Settings > API > `anon` key |
| `CORS_ORIGINS` | Your Vercel domain, e.g. `https://<app>.vercel.app` |
| `CORS_ORIGIN_REGEX` | Optional; leave blank unless you want preview deploys |

`backend/Dockerfile` is an alternative if you'd rather deploy a container
(Cloud Run, Fly, a VPS); the Blueprint above uses Render's native Python runtime
and does not need it.

### Frontend (Vercel)

Set these in **Settings > Environment Variables**, then **redeploy**:

```
VITE_API_URL=https://<your-render-service>.onrender.com/api
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`VITE_*` values are inlined at **build** time, so changing one requires a new
deployment — editing it in the dashboard alone does nothing to the live bundle.
`vite.config.js` fails the build on Vercel/CI if `VITE_API_URL` is missing or
points at `localhost`, so a bundle that asks the visitor's own machine for the
API can't ship silently.

### Order of operations

Deploy the backend first — you need its `.onrender.com` URL for `VITE_API_URL`,
and its `CORS_ORIGINS` needs the Vercel domain. If you're standing both up at
once: deploy backend → set Vercel env vars → redeploy frontend → set
`CORS_ORIGINS` on Render to the final Vercel domain.

**Origins are `scheme://host[:port]`** — no trailing slash, no path.
`https://app.vercel.app/` will never match the browser's `Origin` header.

On Render's free plan the service sleeps when idle; the first request after a
sleep can take ~50s. That looks like a hang in the UI, not an error.

---

## Module Status

| Module | Status |
|---|---|
| Project Management (CRUD) | ✅ Implemented |
| Excel Upload (strict template) | ✅ Implemented — labels must match `Saudi_Template.xlsx` |
| Financial Statements (IS/BS/CFS manual entry) | ✅ Implemented — totals auto-calculated |
| Derived Cash Flow Statement | ✅ Implemented (frontend `deriveCashFlow`, persisted) |
| Financial Ratio Analysis (32 ratios) | ✅ Implemented |
| Horizontal Analysis | ✅ Implemented |
| 5-Year Forecasting | ✅ Implemented — balanced + faithful modes, per-year growth |
| DCF Valuation | ✅ Implemented (frontend-only, backend base metrics) |
| Backend test suite | ✅ 85 tests (`cd backend && python -m pytest`) |
| Auth / multi-user | 🔲 Not implemented — local development tool |
| PDF Export | 🔲 Stretch goal |

See `CLAUDE.md` for architecture contracts (calculation ownership, template
single source of truth) and development commands.
