# Consorcios App

A property management system for residential buildings (consorcios) built with modern web technologies.

## Stack

- **Frontend/Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (PostgreSQL 17)
- **Authentication:** Supabase Auth
- **File Storage:** Supabase Storage
- **Styling:** Tailwind CSS
- **UI Components:** Lucide React

## Setup (Development)

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repo-url>
cd consorcios-app
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` in the repo root (no template checked in — ask a team member
   for the real values) with:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key for client
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key for server-side operations
- `ADMIN_CREATE_SECRET` — Secret for admin user creation endpoints (16+ chars)
- `NEXT_PUBLIC_SITE_URL` — Your site URL (e.g., `http://localhost:3000` in dev)

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available Scripts

- `npm run dev` — Start development server (Turbopack)
- `npm run build` — Build for production
- `npm run start` — Start production server (requires Next.js)
- `npm run start:prod` — Start production with explicit NODE_ENV
- `npm run lint` — Run ESLint on the codebase
- `npm run pm2:start` — Start with PM2
- `npm run pm2:stop` — Stop PM2 process
- `npm run pm2:restart` — Restart PM2 process
- `npm run pm2:logs` — View PM2 logs
- `npm run pm2:monit` — Monitor PM2 processes

## Database Migrations

Migrations live in `supabase/migrations/` and use SQL. To apply a migration:

```bash
# Against the linked Supabase project
npx supabase db query --linked -f supabase/migrations/<filename>.sql
```

Do **not** use `supabase db push` — migrations are applied manually to ensure control over the deployment process.

## Project Structure

- `src/` — Application code (Next.js App Router)
  - `src/app/` — Page routes and layouts
  - `src/app/api/` — API routes
  - `src/actions/` — Server actions
  - `src/components/` — Reusable UI components
  - `src/lib/` — Utilities and helpers
    - `src/lib/supabase/` — Supabase client and auth
    - `src/lib/security/` — Security & audit logging
- `supabase/` — Database schema and migrations
- `public/` — Static assets

## Security

- All requests pass through `src/proxy.ts` for security headers (CSP, CORS, CSRF, rate limiting, IP blocking)
- Role-based access control (RLS) enforced at the database level
- Session management via Supabase Auth with `@supabase/ssr`
- For more, see security comments in `src/proxy.ts`
