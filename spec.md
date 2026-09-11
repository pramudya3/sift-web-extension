# Sift — Spec (Ponytail MVP)

## 1. Overview

**Name:** Sift
**Tagline:** Close your tabs. Keep your research.
**Positioning:** A memory layer for builders' research. Not a tab manager.
**Core loop:** `Research -> Save as Project -> Close tabs without anxiety -> Resume in 1 click`

> Sift answers: "What was I researching and where do I continue?"

## 2. Target User (ICP)

**Core ICP: Builders & Researchers** — anyone whose job is `research -> decision -> build`.

**Persona A: Founder / Indie Hacker (Primary)**
- Solo / early-stage, researches competitor, pricing, API, fundraising, hiring in parallel
- 20-50 tabs = 3-4 projects mixed up (e.g., Instagram API vs Client Project)
- Current hack: OneTab, Notion copy-paste, Chrome tab groups
- Will pay if: can close tabs without losing 3h of research context

**Persona B: Software Engineer / Product Engineer (Primary)**
- Researches docs, GitHub issues, Stack Overflow, API refs, architecture decisions
- 30+ tabs across `docs + PRs + tickets + logs` — context lost after meetings / context switch
- Current hack: keep tabs open as TODO, bookmark folders, `// TODO` tabs
- Will pay if: can snapshot `debugging / feature research` and resume after standup without re-finding tabs

**Persona C: Researcher / Analyst (Secondary)**
- Academic, market researcher, VC analyst — literature review, market reports, data sheets
- 40+ papers/tabs, needs `What was I researching yesterday?` + next step
- Will pay if: can sift papers into projects with auto summaries

**Extended (related fields, same pain):** Product Manager, Designer, Tech Lead, Data Scientist, DevRel — anyone doing deep web research to build/ship.

**Anti-ICP:** Casual browsing, students (unless building), entertainment/shopping tab hoarders. Ignore.

## 3. Problem

Tabs are external memory. Builders keep tabs open because `close = forget`. Result: clutter, anxiety, `30 tabs = 30 unfinished things`.

Sift reframes: `30 tabs = 3 active contexts`. Save context, close tabs. Whether it's a founder validating pricing, an engineer spiking an API, or a researcher reviewing papers — same anxiety, same fix.

## 4. Tech Stack (Minimal)

**Extension (Product):**
```
WXT + TypeScript + Tailwind CSS + shadcn
Manifest V3, chrome.sidePanel + chrome.storage.local + IndexedDB
```
No backend for MVP. No framework inside extension beyond WXT.

**Landing (Validation):**
```
Astro + Tailwind + Cloudflare Pages (or Vercel)
Plausible/PostHog script for analytics (no custom panel)
```
No Next.js, no Bun runtime for MVP. `pnpm + Node LTS`.

**Later (only when 500+ active users ask for sync):**
```
API: Hono + Bun + Supabase/Turso + Better Auth + AI proxy (see §9)
Dashboard: Next.js at app.sift.so (only for cross-device/share)
```
> Stack is intentionally Bun + Hono, NOT Go/Rust. Solo velocity > 10ms perf. Go/Rust only when Bun latency hurts paying users at 1M+ req/day.

## 5. Architecture (MVP)

```
Chrome Window (tabs)
      |
      v
WXT Extension [Popup + Side Panel]
      |
      v
chrome.storage.local / IndexedDB { projects, tabs, stats }
```

No `https` call for MVP. Stats computed locally.
When API exists: `Side Panel --fetch()--> api.sift.so` (add host_permissions). Still no web dashboard. AI calls are on-demand `POST /ai/*` only when user clicks "Sift with AI" (never auto).

## 6. MVP Features (2 Weeks Max)

Only 3 features. Everything else is YAGNI.

### 6.1 Save Current Window as Project
- Trigger: Side Panel button `Save this window` or Popup `Sift this window`
- Input: Project name (auto-suggest: dominant domain/topic, editable)
- Captures per tab: `{ url, title, favicon, domain, lastActiveAt, createdAt }`
- Action after save: Optional `Close tabs` (with confirmation)
- Limit (free): 3 projects / 30 tabs total -> paywall trigger

### 6.2 List & Resume Projects
- View: Side Panel list `Project name | tab count | lastActive (e.g., 2h ago)`
- Actions: `Open all` (new window), `Open + Close others`, `Delete`
- Search: filter by project name/domain (local, no semantic search)

### 6.3 Local Analytics (Inside Side Panel, No Web App)
- Computed locally from storage, no API
```
3 Projects | 47 Tabs Saved | ~2h Saved (est. 2min/tab)
Most active: Instagram API - 8 tabs - 20m ago
```
- Also: Group by domain inside project (rule-based: `new URL(url).hostname`), no AI.

## 7. Non-Goals (Explicitly Skipped for MVP)

- No backend, no auth, no sync, no cloud
- No AI grouping/summary/next-step (rule-based only)
- No web dashboard at `app.sift.so`
- No duplicate detection, no snooze, no tab history beyond current window
- No Firefox/Safari, no team/share

> Add when validated: cloud sync -> AI summary -> web dashboard -> team.

## 8. Data Model (Local)

```ts
// IndexedDB / chrome.storage.local
type Project = {
  id: string // nanoid
  name: string // "Instagram API Research"
  createdAt: number
  lastActiveAt: number
  tabs: Tab[]
}

type Tab = {
  url: string
  title: string
  favicon?: string
  domain: string // new URL(url).hostname
  lastActiveAt?: number
  createdAt: number
}

type Stats = {
  totalProjects: number
  totalTabs: number
  estimatedTimeSavedMin: number // tabs * 2
}
```

## 9. AI Layer (Future Seam — Do Not Build for MVP)

**Status:** Designed, not built. Leave seam only. Build in Phase 2 after 500 active + 20 paying.

**Why not now:** Rule-based `group by domain` solves 80% of `What was I doing?`. AI is $ cost + privacy risk before PMF.

**When built, architecture:**
```
Side Panel ["Sift with AI" button]
      |  { titles[], domains[] }  // metadata only, no HTML
      v
api.sift.so/ai/summarize (Hono + Bun, Cloudflare Workers / Fly)
      |  prompt: "Group these 10 tabs, name project, summarize, suggest next step"
      +---> AI Provider (OpenAI / Anthropic via OpenRouter) // env AI_PROVIDER=
      |
      v
{ projectName, summary, nextAction } -> Side Panel
```

**Minimal endpoint (Hono, 30 lines, not Go/Rust):**
```ts
// api/src/routes/ai.ts
import { OpenAI } from "openai";
app.post("/ai/summarize", async (c) => {
  const { tabs } = await c.req.json(); // [{title, domain}] - ponytail: metadata only
  const prompt = `You are Sift. Group these tabs into one research project. Return JSON {projectName, summary: 2 sentences, nextAction: 1 sentence}: ${JSON.stringify(tabs)}`;
  const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
  const res = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
  return c.json(JSON.parse(res.choices[0].message!.content!));
});
```

**Rules:**
- On-demand only (button, not auto) — controls cost (~$0.002/project) & privacy
- Metadata-only input — never send `pageContent`/`history` unless user opts in
- Provider abstraction = `AI_PROVIDER` env var (OpenRouter lets you swap with 1 line), not an abstraction layer with 5 interfaces
- No vectors/embeddings/DB for MVP — plain prompt over titles is enough until semantic search is top request
- Do NOT use Go/Rust: Bun handles 10k users at 50ms. Rewrite only when p95 >300ms for paying users.

# ponytail: on-demand AI proxy, metadata only. No Go/Rust, no vectors, no local LLM until Pro revenue proves it.

## 10. Extension Spec

**Manifest V3 permissions:**
```json
{
  "permissions": ["tabs", "storage", "sidePanel"],
  "host_permissions": [] // add ["https://api.sift.so/*"] only in Phase 1
}
```

**UI surfaces:**
- **Popup (400x500):** Quick `Sift this window (23 tabs)` + `3 projects` list + `Open Side Panel`
- **Side Panel (primary):** Full project list, search, stats, `Save` + `Resume` actions. This is the analytics panel.
- **Options page:** None for MVP.

**File structure (WXT):**
```
sift-extension/
  entrypoints/
    popup/ (popup.html + App.tsx)
    sidepanel/ (index.html + App.tsx)
    background.ts
  components/ui/ (shadcn)
  utils/storage.ts (IndexedDB wrapper)
  utils/groupByDomain.ts
  wxt.config.ts
```

**Commands:**
```bash
pnpm create wxt@latest sift-extension
pnpm dev # load unpacked .output/chrome-mv3
pnpm zip # for store upload
```

## 11. Landing Spec (Astro)

**Domain:** `sift.so` (alts: getsift.app, siftformemory.com)
**Pages:** Single page only `/`
- Hero: `Close your tabs. Keep your research. / Your research, sifted. Not scattered.`
- Demo GIF (fake, 10s): Save -> Close -> Resume
- Social proof: waitlist count
- CTA: Email waitlist (Tally / Loops / Formspree)
- Footer: privacy note `No page content sent. Metadata only. Local-first.`

**No login, no dashboard.**
Deploy: Cloudflare Pages. Analytics: Plausible (1 script tag).

## 12. Distribution

- **Weeks 1-2:** `Load unpacked` ZIP to 20 waitlist builders (founders + engineers) (manual)
- **Weeks 3-4:** `Unlisted` on Chrome Web Store (private link, still reviewed)
- **After PMF:** `Public` listing ($5 fee). Edge Add-ons for free (same bundle).

## 13. Roadmap (Ponytail)

- **Phase 0 (Now, 2 weeks):** Spec above. Validate with 20 builders (10 founders + 10 engineers).
- **Phase 1 (After 100 active):** Add backend `api.sift.so` for sync. Side Panel hits API. Still no web dashboard. Pro: unlimited projects ($29/yr or $5/mo).
- **Phase 2 (After 500 active + 20 paying):** AI layer (context detection, summary, next step) as Pro. Still side panel.
- **Phase 3 (After cross-device demand):** `app.sift.so` Next.js dashboard for history/search/share + team.

## 14. Success Metrics (MVP)

- 200 waitlist emails in 2 weeks (landing)
- 20 builders (founders/engineers/researchers) install unpacked ZIP
- 50% retain after 7 days (saved >=2 projects)
- 5/20 say "I'd pay to keep this" (interview) — signal is same across all three personas

## 15. Open Decisions

- Free limit: 3 projects vs 5? Start 3, easy to relax.
- Auto-name algorithm: most frequent domain vs last active tab title? Start with editable placeholder.

---
# ponytail: Local-only first, no backend/dashboard/AI. Add API when storage limit hurts, add web dashboard when cross-device is top request.
