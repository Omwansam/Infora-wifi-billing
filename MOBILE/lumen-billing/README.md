# Infora Billing — Mobile

The mobile companion for the **Infora WiFi/ISP billing system** (the main admin
platform, not the Lumen website or demo). Built with **Expo Router + React
Native + NativeWind**, it mirrors the web admin's domain — Kenyan WISP data,
KES currency, M-Pesa payments, MikroTik routers.

> Status: **UI complete + live data layer wired.** Every screen fetches through
> the service layer (`src/services`) via hooks (`src/hooks/use-data.ts`). With no
> API URL configured the app runs in **demo mode** on seeded mock data; set
> `EXPO_PUBLIC_API_URL` and it talks to the real Infora backend (`backend/server`).

## Get started

```bash
npm install

# Demo mode (mock data, no backend needed):
npx expo start

# Live mode — point at the Infora API:
cp .env.example .env         # then set EXPO_PUBLIC_API_URL
npx expo start
```

Open on Android/iOS (Expo Go or a dev build) or the web.

## Tech

- **Expo SDK 56** + **Expo Router** (file-based routing, `src/app`)
- **React Native 0.85 / React 19** (React Compiler enabled)
- **NativeWind 4** (Tailwind CSS for RN) — config in `tailwind.config.js`,
  entry stylesheet `src/global.css`
- **@expo/vector-icons** (Ionicons) for iconography

## Design system

- **Color tokens** — `tailwind.config.js`, `src/lib/theme.ts`
- **Formatting (KES)** — `src/lib/format.ts`
- **UI primitives** — `src/components/ui/*` (Card, Badge, StatCard, Avatar, Screen, Button, FilterChips, MiniBarChart …)
- **Mock data** — `src/data/mock.ts` + `src/data/types.ts`

Brand primary is `#2563EB` (matches the web admin). Light/dark mode follow the
system appearance and can be toggled in **Settings**.

## Data layer (`src/services`, `src/hooks`)

Talks to the Flask backend in `backend/server` (JWT auth, `/api/*`, snake_case
JSON). Mirrors the web app's `FRONTEND/infora_billing/src/services`.

```text
src/services/
  config.ts     API base URL (EXPO_PUBLIC_API_URL) + endpoint map; IS_LIVE flag
  http.ts       fetch wrapper — bearer auth, timeout, 401 refresh-and-retry
  session.ts    JWT + user persisted in the device keychain (expo-secure-store)
  auth.ts       login / restoreSession / logout
  mappers.ts    snake_case DTO → camelCase domain types (src/data/types.ts)
  customers.ts plans.ts billing.ts tickets.ts devices.ts finance.ts dashboard.ts
src/contexts/session.tsx   <SessionProvider> + useSession() — app-wide auth state
src/hooks/use-query.ts     tiny data hook: { data, loading, error, refetch }
src/hooks/use-data.ts      useDashboard / useCustomers / usePlans / … per domain
```

**How it flows:** screen → `useX()` hook → service → `http` → API, with results
mapped to domain types so the UI never sees snake_case. Every service falls back
to the seeded mock (`src/data/mock.ts`) when `EXPO_PUBLIC_API_URL` is unset, so
the app is fully usable offline and screens render identically in both modes.

**Auth:** `SessionProvider` restores the persisted JWT on boot and verifies it;
`src/app/index.tsx` gates entry (→ tabs or login). Login calls the real
`/api/auth/login`; in demo mode any credentials are accepted.

**Adding a screen to the live layer:** add a function in the relevant service +
a `useX` hook, then consume it — `const { data, loading, error, refetch } = useX()`
— rendering `<Loading />` / `<ErrorState onRetry={refetch} />` while `data` is
undefined. All read screens already follow this pattern.

> Not yet wired to live endpoints (still static): **Communication** and
> **Network & RADIUS** overview screens, and mutations (create/edit/pay). The
> read services + hooks above are the template for adding them.

## Screens (`src/app`)

- `(auth)/login` — branded sign-in
- `(tabs)` — bottom navigation:
  - `index` — **Dashboard**: collections hero, KPIs, quick actions, revenue mix,
    alerts, top data users, recent payments
  - `clients` — searchable/filterable client list → `clients/[id]` profile
  - `billing` — hub → `payments`, `invoices` (+ `invoices/[id]`),
    `transactions`, `vouchers`
  - `plans` — service plans → `plans/[id]` detail
  - `more` — menu → `sessions`, `tickets` (+ `tickets/[id]` thread), `devices`,
    `network`, `communication`, `finance`, `settings`

## Scripts

```bash
npm run android   # open on Android
npm run ios       # open on iOS
npm run web       # open in browser
npm run lint      # expo lint
```
