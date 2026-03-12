# PolyGrid Studio — Implementation Progress

## Completed

- [x] **Project Setup** — Tauri 2.x + React 19 + TypeScript strict + Vite
- [x] **Tailwind CSS v4** — with @tailwindcss/vite plugin, CSS variables in globals.css
- [x] **shadcn/ui** — configured (new-york style, zinc base), components: button, input, label, select, badge, dialog, tooltip, separator, scroll-area
- [x] **Design System** — Industrial-minimal theme, light/dark mode, Inter + JetBrains Mono fonts, full CSS variable system
- [x] **App Shell** — AppShell + collapsible Sidebar (240px/64px) + ThemeProvider
- [x] **Sidebar** — Navigation with all 11 items, theme switcher (cycling/segmented), collapse toggle, tooltips
- [x] **Database** — SQLite via tauri-plugin-sql, migration with all 9 tables, db.ts singleton, JSON helpers
- [x] **Zustand UI Store** — theme + sidebar state with localStorage persistence
- [x] **i18n** — de.json with nav, common, theme, shortcuts, and per-module strings
- [x] **Products Module** — Full CRUD: Zod schemas, Zustand store, SQL queries, ProductsPage, ProductTable (TanStack Table), CreateProductDialog, ProductDetailPanel, MarginCalculator, StatusBadge
- [x] **Expenses Module** — Full CRUD: types, Zustand store, SQL queries, ExpensesPage, ExpenseTable (TanStack Table with sum footer), CreateExpenseDialog, ExpenseDetailPanel with tax disclaimer
- [x] **Orders Module** — Full CRUD: types (10 order statuses, payment/shipping tracking), Zustand store, SQL queries, OrdersPage, OrderTable (with revenue sum), CreateOrderDialog, OrderDetailPanel with profit calculation, OrderStatusBadge
- [x] **Tasks Module** — Full CRUD: types (priority/status), Zustand store, SQL queries, TasksPage (list view with status tabs, toggle done, overdue indicators), CreateTaskDialog
- [x] **Listings Module** — Full CRUD: types, Zustand store, SQL queries (with JSON array parsing for bullet_points/tags/variants), ListingsPage (card layout with filters), CreateListingDialog (with product picker)
- [x] **Templates Module** — Full CRUD: types (9 categories), Zustand store, SQL queries (auto-increment version on content change), TemplatesPage (card layout, legal disclaimer), CreateTemplateDialog
- [x] **AppShell Routing** — All 6 built modules wired into route switch (Products, Expenses, Orders, Tasks, Listings, Templates)

## Remaining

### Phase 2: Routing & Infrastructure
- [ ] **TanStack Router** — Replace manual route state in AppShell with proper file-based routing
- [ ] **Command Palette** — Cmd+K dialog with fuzzy search across modules
- [ ] **Keyboard Shortcuts** — Cmd+N, Cmd+S, Cmd+/, Cmd+1-9 module navigation

### Phase 3: Remaining Feature Modules
- [ ] **Files Module** — file_links management, OneDrive path browsing, entity linking
- [ ] **Dashboard** — KPI cards (revenue, orders, margin), recent orders, product status overview, quick actions
- [ ] **Analytics** — Revenue charts (Recharts), expense breakdown, margin trends, platform comparison

### Phase 4: Remaining Database Queries
- [ ] **File Links queries** — listFileLinks, createFileLink, deleteFileLink
- [ ] **AI Jobs queries** — createAiJob, updateAiJob, listAiJobs

### Phase 5: AI Integration
- [ ] **AI Provider Interface** — AIProvider abstract class, AIOptions, AIResponse types
- [ ] **ClaudeProvider** — Anthropic API integration
- [ ] **OpenAIProvider** — OpenAI API integration
- [ ] **OllamaProvider** — Local Ollama integration
- [ ] **AI Service** — Provider registry, fallback logic, job logging
- [ ] **ListingAssistant Agent** — Generate listing titles, descriptions, bullet points, tags
- [ ] **AI Assistant UI** — Chat/prompt interface, provider selection, history

### Phase 6: Services & Integrations
- [ ] **Filesystem Service** — OneDrive folder browsing via Tauri commands
- [ ] **Export Service** — CSV/JSON export for products, expenses, orders
- [ ] **Tauri Commands** — Rust commands for file operations

### Phase 7: Settings & Polish
- [ ] **Settings Page** — AI provider config (API keys via OS keychain), default values, data management
- [ ] **English translations** — en.json
- [ ] **Error boundaries** — Global error handling
- [ ] **Loading states** — Skeleton screens for all modules

## Architecture Notes

- Each feature module follows: `types.ts` (Zod) → `store.ts` (Zustand) → `queries.ts` (SQL) → `components/`
- Products module is the reference implementation for all other CRUD modules
- Manual route state in AppShell.tsx — to be replaced with TanStack Router
- No Tauri custom commands yet — only tauri-plugin-sql capabilities configured
- All modules connected in AppShell with route switch pattern
