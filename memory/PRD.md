# PRD - CRMaster

## Original Problem Statement
A Turkish CRM application built on React + FastAPI + Supabase PostgreSQL. The user (CRM owner, Turkish) wants to manage and enhance the application iteratively. Latest emphasis: **complete visual redesign** with modern minimalist design language across all pages.

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, shadcn/ui, react-grid-layout, recharts/chart.js, sonner, lucide-react
- **Backend**: FastAPI, Supabase Python Client (PostgreSQL), APScheduler
- **Auth**: Emergent Google OAuth + JWT fallback (X-Session-Token header)
- **Deployment**: Render Free Tier (read-only fs, ephemeral storage)

## What's Implemented

### Core CRM Features (pre-existing & maintained)
- Customer CRUD with rich fields (market, application, partner, products, status, etc.)
- Kanban board (drag/drop, custom views, multi-grouping)
- Visit & Call tracking
- Follow-up reminders + notifications bell
- Filters page (saved custom filters)
- Calendar view
- Reports
- Inline editing across all customer cells
- Mobile-responsive (card view on small screens)
- Automated backups (APScheduler)
- Customer deduplication (manual + auto-merge ≥%95)
- Data completeness sorting
- Performance: cached queries, ~238ms customer fetch

### Security
- ✅ Google OAuth whitelist check on `/auth/session` (was missing — fixed Feb 2026)
- ✅ Cleanup endpoint also revokes active sessions of removed users

### Design Refresh (Feb 2026) — DONE
- **Design Direction**: Modern + minimalist (Eduplex / DealDeck inspired), light-only theme
- **Accent**: Electric Indigo (#4F46E5 → #6366F1 gradient on hero)
- **Typography**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (numbers)
- **CSS variable-based theme system** (`/app/frontend/src/index.css`) — every page automatically inherits new tokens
- **New Layout** (`Layout.jsx`): Modern sidebar (CR monogram, indigo active item, user card with avatar + admin badge at bottom), glass topbar (search trigger + ⌘K hint + notifications), responsive mobile drawer
- **Customers page**: Gradient letter avatars per company (deterministic colors), Plus Jakarta Sans firma names, pastel pill tags (rounded-md, no border), wider columns so all data fits, modern indigo CTAs
- **Dashboard**: Compact KPI cards (~90px tall, Eduplex style), hero indigo "Müşteri" card with glow blob, rounded bar charts + donut charts with white separators, all sized via react-grid-layout (rowHeight 40px)
- **Login**: Indigo gradient logo, lila/violet blob background, modern indigo CTAs
- **All other pages** (Kanban, Visits, Followups, Filters, Calendar, Reports, Settings, Users, Duplicates) updated via global color token migration (bg-white → bg-card, text-slate-* → semantic tokens, emerald/blue accents → indigo)

## File Architecture
```
/app/
├── backend/
│   ├── server.py             # Monolithic FastAPI (~4615 lines)
│   ├── backup_service.py     # APScheduler JSON backups
│   └── sessions.json         # Session persistence fallback
├── frontend/src/
│   ├── App.js                # Router + Theme/Auth/Modal providers
│   ├── index.css             # Design tokens + glass/glow utilities + animations
│   ├── tailwind.config.js    # Theme-aware color tokens + custom shadows
│   ├── components/
│   │   ├── Layout.jsx        # NEW modern sidebar + glass topbar
│   │   ├── ThemeToggle.jsx   # (deprecated, dark mode disabled)
│   │   ├── InlineCreatableSelect.jsx   # Updated to pastel rounded-md pills
│   │   ├── FollowupNotifications.jsx
│   │   ├── AutomatedBackupSettings.jsx
│   │   └── MobileCustomerList.jsx
│   ├── contexts/
│   │   ├── ThemeContext.jsx  # light-only (per user pref)
│   │   └── CustomerModalContext.jsx
│   └── pages/
│       ├── Login.jsx         # Redesigned
│       ├── Dashboard.jsx     # Hero KPI + rounded bar/donut
│       ├── Customers.jsx     # Avatar gradients + wider cols + pastel pills
│       ├── Kanban.jsx
│       ├── Visits.jsx, Followups.jsx, FiltersPage.jsx, CalendarPage.jsx,
│       ├── ReportsPage.jsx, SettingsPage.jsx, UsersPage.jsx,
│       └── DuplicatesPage.jsx, CustomerDetailPage.jsx
└── memory/
    ├── PRD.md, test_credentials.md, PERFORMANCE_SETUP.md
```

## Key Design Tokens (CSS variables in `index.css`)
- `--primary`: 239 84% 58% (Electric Indigo)
- `--primary-hover`: 244 75% 53%
- `--background`: 220 14% 96%
- `--card`: 0 0% 100%
- `--muted`: 220 14% 96%
- `--border`: 220 13% 91%
- Status pastels: success/info/warning/purple/danger/pink each with bg + fg pair
- Chart palette: indigo, emerald, cyan, amber, violet, pink, slate
- Glass utility: `.glass` with `backdrop-blur(20px) saturate(150%)`
- Glow utility: `.glow-soft`, `.glow-accent`
- Animations: `fade-in-up`, `slide-in-right`, `pulse-glow` + staggered children via `[data-stagger]`

## Test Credentials
File: `/app/memory/test_credentials.md`
- Admin: `admin.test@crmaster.local` / `Admin1234`

## Backlog / Future
- **P0**: Toplu İşlemler (Bulk Actions) — backend `bulk-delete` + `bulk-update` endpoints, frontend dropdown for Sil/Pazar/Atama
- **P1**: Command Palette (Cmd/Ctrl+K) + keyboard shortcuts
- **P1**: FollowupNotifications Radix UI Popover warning fix
- **P2**: AI Customer Summary + AI Email Drafts (Gemini)
- **P2**: Saved Filters/Views improvements
- **P3**: Optional dark mode (currently disabled per user)
- **Tech debt**: server.py (~4600 lines) and Customers.jsx (~2100 lines) refactoring (user has explicitly deferred this in favor of features)

## Critical Notes for Future Agents
1. **Render Free Tier**: read-only `/app` root. Use relative paths (`./backups`) for file writes.
2. **Auth**: `/auth/session` (NOT `/auth/callback`) is the actual endpoint Google login hits — whitelist check MUST be there.
3. **Cache invalidation**: server.py heavily caches; call `_invalidate_kanban_cache()` and clear globals after writes.
4. **Dashboard layout localStorage key**: bump `STORAGE_KEY` in Dashboard.jsx (currently `crm_dashboard_v8`) whenever default layouts change to force user reset.
5. **Customer column widths**: bumped to `crmaster_column_widths_v3`.
6. **No dark mode**: user explicitly opted out. Light-only.
7. **Design language**: Plus Jakarta Sans headings + Inter body + indigo accent + pastel rounded-md pills + gradient avatars. Keep consistent.

## Recent Changes (Feb 2026)
- 🔒 Auth whitelist bypass fixed in `/auth/session`
- 🐛 Duplicate auto-merge: scan at threshold=90 regardless of min_score (boost-after-filter bug)
- 🎨 Complete visual redesign (light-only, indigo accent, modern minimalist)
- 🎨 Customer column widths increased, all data fits
- 🎨 All pages migrated to semantic color tokens via global sed
