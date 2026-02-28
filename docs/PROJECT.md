# MAX Lead Generation System — Complete Project Documentation

## What Is MAX?

MAX is an AI-powered local business lead generation system. It finds businesses that don't have websites, builds demo sites for them, sends personalized outreach emails, handles objections via AI, and closes sales — all automated through a pipeline of 6 specialized AI agents.

## Architecture

```
                    ┌─────────────┐
                    │  Telegram    │
                    │  (OpenClaw)  │
                    └──────┬──────┘
                           │ HTTP API
┌──────────────┐    ┌──────┴──────────────────────────┐
│  Dashboard   │────│         Next.js 16               │
│  (Browser)   │    │  App Router + API Routes         │
└──────────────┘    │  + SSE Activity Stream           │
                    │  + Rate Limiting Middleware       │
                    └──────┬──────────────────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
        ┌─────┴─────┐ ┌───┴────┐   ┌───────┴───────┐
        │ PostgreSQL │ │ Redis  │   │ BullMQ Worker │
        │  (Prisma)  │ │        │   │  (6 agents)   │
        └───────────┘ └────────┘   └───────────────┘
```

**Two processes in production:**
1. `next start` — serves dashboard UI, API routes, SSE stream, middleware
2. `tsx worker.ts` — runs BullMQ background job workers for all 6 agents

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.9.3 |
| UI | React + Tailwind CSS v4 | 19.2.4 / 4.2.1 |
| ORM | Prisma | 6.19.2 |
| Database | PostgreSQL | Managed (Railway) |
| Queue | BullMQ + ioredis | 5.70.1 / 5.9.3 |
| LLM | OpenRouter (multi-model) | REST API |
| Email | Resend | 6.9.2 |
| Payments | Stripe | 20.4.0 |
| Webhook Verification | Svix | 1.86.0 |
| Hosting Target | Railway | ~$5/mo |

## Database Schema (8 tables)

| Table | Purpose |
|-------|---------|
| `campaigns` | Groups of leads by location + category |
| `businesses` | Raw business data from Google Places |
| `leads` | Business → lead lifecycle tracking with status + score |
| `demo_sites` | Generated HTML sites with deploy URLs |
| `outreach_messages` | Email history (initial + follow-ups), open/click tracking |
| `payments` | Stripe Payment Link records, paid status |
| `agent_runs` | Tracks every agent execution (QUEUED → RUNNING → COMPLETED/FAILED) |
| `activity_log` | Human-readable event stream for the dashboard |

Full schema: `prisma/schema.prisma`

## The 6 AI Agents

### 1. Scout Agent — Lead Discovery
- **Trigger**: Campaign creation (UI or chat command)
- **How**: Google Places API Text Search → filter businesses without websites → upsert to DB
- **Output**: New `businesses` + `leads` records, activity log entries
- **File**: `src/workers/scout.worker.ts` + `src/services/scout.service.ts`

### 2. Intel Agent — Business Research
- **Trigger**: Enqueued after scout, or manually via chat/API
- **How**: LLM reads business data → generates profile (summary, strengths, weaknesses, opportunities) → scores lead 0-100
- **Output**: `profileJson` on lead, `score` field, status → RESEARCHED
- **File**: `src/workers/intel.worker.ts` + `src/services/intel.service.ts`

### 3. Builder Agent — Demo Site Generation
- **Trigger**: After intel completes, or manually
- **How**: LLM generates copy (headline, about, services, CTA) → fills category-specific HTML template → deploys to Cloudflare Pages
- **Templates**: Restaurant, plumber, generic — auto-selected by category
- **Output**: `demo_sites` record with live URL, lead status → SITE_BUILT
- **File**: `src/workers/builder.worker.ts` + `src/services/builder.service.ts`

### 4. Outreach Agent — Email Sequences
- **Trigger**: After site is built, or manually
- **How**: LLM generates personalized email with demo site link → sends via Resend → schedules follow-ups at day 3, 7, 14
- **Tracking**: Resend webhooks track opens, clicks, bounces, complaints
- **Output**: `outreach_messages` records, lead status → CONTACTED
- **File**: `src/workers/outreach.worker.ts` + `src/services/outreach.service.ts`

### 5. Closer Agent — AI Objection Handling
- **Trigger**: Inbound email reply webhook
- **How**: Classifies reply (interested/objection/question/not_interested) → generates contextual response → auto-sends or drafts for approval
- **Behavior by classification**:
  - INTERESTED → sends payment link
  - OBJECTION → addresses concerns with context
  - QUESTION → answers based on lead data
  - NOT_INTERESTED → graceful exit
- **Config**: `CLOSER_AUTO_REPLY` env (default: false = draft mode)
- **File**: `src/workers/closer.worker.ts` + `src/services/closer.service.ts`

### 6. Scheduler (Growth)
- **Trigger**: Repeatable BullMQ job every 6 hours
- **How**: Re-engages stalled leads, triggers follow-ups for opened-but-no-reply leads
- **File**: `src/workers/scheduler.worker.ts`

## LLM Configuration

OpenRouter as unified gateway. Model routing per task type:

| Task | Model | Why |
|------|-------|-----|
| Classification (intent, reply) | DeepSeek (free tier) | Fast, cheap, good at structured output |
| Builder copy generation | MiniMax M1 | Strong at HTML/marketing copy |
| Closer responses | Claude Sonnet 4 | Nuanced, persuasive, handles objections |
| Intel profiling | DeepSeek | Structured analysis, cost-effective |

Config: `src/integrations/llm/models.ts` (task → model mapping)
Client: `src/integrations/llm/openrouter.ts` (`generateText()` + `generateJSON<T>()`)

## API Routes (16 endpoints)

### Dashboard API
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard/stats` | Summary stats (found, built, sent, replied) |
| GET | `/api/activity` | Recent activity log entries |
| GET | `/api/activity/stream` | SSE stream for live activity feed |
| GET | `/api/campaigns` | List all campaigns with lead counts |
| POST | `/api/campaigns` | Create campaign (name, location, category) |
| GET | `/api/leads` | List leads with filters (campaignId, status, limit, offset) |
| POST | `/api/leads/[id]/payment` | Create Stripe payment link for a lead |
| POST | `/api/agents/[name]/run` | Enqueue an agent job (scout/intel/builder/outreach/closer) |
| GET | `/api/agents/[name]/status` | Check agent run status |
| POST | `/api/chat` | Natural language → intent parsing → agent routing |

### OpenClaw Integration API (x-api-key authenticated)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/openclaw/campaigns` | List campaigns |
| GET | `/api/openclaw/leads` | List leads with filters |
| POST | `/api/openclaw/leads/[id]/action` | Trigger agent action on a lead |
| GET | `/api/openclaw/stats` | Dashboard stats |

### Webhooks
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/webhooks/email` | Resend events (open, click, bounce, complaint) |
| POST | `/api/webhooks/email/inbound` | Inbound email replies → closer agent |
| POST | `/api/webhooks/stripe` | Stripe checkout.session.completed → CLOSED_WON |

## Dashboard UI

Dark theme (`#0C0C0C` background, `#111` cards). 4 pages:

1. **`/` (Dashboard)** — 6 agent status cards, top bar with stats (found/built/sent/replied), live activity sidebar with SSE, chat input bar
2. **`/campaigns`** — Create campaigns (name + location + category), auto-launches scout agent, campaign list with lead counts
3. **`/leads`** — Filterable lead table with status, score, rating, demo site columns
4. **`/leads/[id]`** — Lead detail: business info, AI analysis (strengths/weaknesses/opportunities), outreach history, payment status + payment link button

### UI Infrastructure
- **Loading skeletons**: All 4 routes have `loading.tsx` with animated pulse skeletons matching the dark theme
- **Error boundaries**: All routes have `error.tsx` with retry + navigation buttons
- **Activity feed**: Real-time via SSE with exponential backoff reconnection (2s → 30s cap), de-duplication via Set, max 100 entries

## Middleware

`src/middleware.ts` — runs on all `/api/*` routes:

**Rate limiting** (in-memory, per-IP, 60-second window):
| Route Pattern | Requests/min |
|--------------|-------------|
| `/api/chat` | 20 |
| `/api/webhooks/*` | Exempt (signature-verified) |
| `/api/openclaw/*` | 100 |
| All other `/api/*` | 60 |

**Authentication**: OpenClaw API routes require valid `x-api-key` header matching `OPENCLAW_API_KEY` env.

**Response headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining` on all API responses. `Retry-After: 60` on 429 responses.

## Error Handling Strategy

### API Routes
Every route handler is wrapped in try/catch. Errors are:
1. Logged via structured JSON logger (`src/lib/logger.ts`) with route context
2. Returned as `{ error: "..." }` with appropriate HTTP status codes
3. Never leak stack traces or internal details to the client

### Input Validation
- Campaign creation: validates name, location, category are non-empty strings
- Chat: validates message is string, max 1000 characters, catches malformed JSON
- Agent run: validates agent name against known enum
- Payment: validates leadId from URL params
- OpenClaw action: validates action against whitelist, verifies lead exists

### Workers
All BullMQ workers:
- Track status in `agent_runs` table (QUEUED → RUNNING → COMPLETED/FAILED)
- Log to `activity_log` for dashboard visibility
- Store error messages in `agent_runs.error` on failure
- Fire OpenClaw webhook notifications on state changes

## External Integrations

| Service | Client File | Auth |
|---------|------------|------|
| Google Places API | `src/integrations/maps/places.ts` | API key |
| OpenRouter LLM | `src/integrations/llm/openrouter.ts` | API key |
| Resend Email | `src/integrations/email/resend.ts` | API key |
| Stripe Payments | `src/integrations/payment/stripe.ts` | Secret key |
| Cloudflare Pages | `src/integrations/deploy/cloudflare.ts` | API token |
| OpenClaw Bot | `src/integrations/openclaw/client.ts` + `notify.ts` | API key |

## Environment Variables

See `.env.example` for the full list. Required:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection (defaults to `redis://localhost:6379`)
- `OPENROUTER_API_KEY` — LLM API access
- `GOOGLE_MAPS_API_KEY` — Places API ($200/mo free credit)
- `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET` — Email sending + webhook verification
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Payments
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — Site deployment
- `OPENCLAW_WEBHOOK_URL` + `OPENCLAW_API_KEY` — Bot integration (optional)
- `CLOSER_AUTO_REPLY` — `true`/`false` for auto-sending closer replies (default: false)

## File Structure

```
src/
├── app/
│   ├── page.tsx                          # Dashboard (SSR)
│   ├── loading.tsx                       # Dashboard skeleton
│   ├── error.tsx                         # Global error boundary
│   ├── campaigns/
│   │   ├── page.tsx                      # Campaign list + create
│   │   ├── loading.tsx                   # Campaigns skeleton
│   │   └── error.tsx                     # Campaigns error boundary
│   ├── leads/
│   │   ├── page.tsx                      # Lead list with filters
│   │   ├── loading.tsx                   # Leads skeleton
│   │   ├── error.tsx                     # Leads error boundary
│   │   └── [id]/
│   │       ├── page.tsx                  # Lead detail
│   │       ├── loading.tsx               # Lead detail skeleton
│   │       └── error.tsx                 # Lead detail error boundary
│   └── api/
│       ├── activity/
│       │   ├── route.ts                  # GET activity log
│       │   └── stream/route.ts           # SSE activity stream
│       ├── agents/[name]/
│       │   ├── run/route.ts              # POST enqueue agent
│       │   └── status/route.ts           # GET agent status
│       ├── campaigns/route.ts            # GET/POST campaigns
│       ├── chat/route.ts                 # POST chat → intent → agent
│       ├── dashboard/stats/route.ts      # GET summary stats
│       ├── leads/
│       │   ├── route.ts                  # GET leads
│       │   └── [id]/payment/route.ts     # POST create payment link
│       ├── openclaw/                     # External API (x-api-key auth)
│       │   ├── campaigns/route.ts
│       │   ├── leads/route.ts
│       │   ├── leads/[id]/action/route.ts
│       │   └── stats/route.ts
│       └── webhooks/
│           ├── email/
│           │   ├── route.ts              # Resend events
│           │   └── inbound/route.ts      # Inbound replies → closer
│           └── stripe/route.ts           # Stripe checkout events
├── components/
│   ├── dashboard/
│   │   └── activity-feed.tsx             # SSE-connected live feed
│   └── ui/                               # Shared UI primitives
├── integrations/
│   ├── deploy/cloudflare.ts
│   ├── email/resend.ts
│   ├── llm/
│   │   ├── openrouter.ts                # generateText + generateJSON
│   │   └── models.ts                    # Task → model routing
│   ├── maps/places.ts
│   ├── openclaw/
│   │   ├── client.ts                    # API key verification
│   │   └── notify.ts                    # Fire-and-forget webhooks
│   └── payment/stripe.ts
├── lib/
│   ├── db.ts                            # Prisma client singleton
│   ├── redis.ts                         # ioredis connection
│   ├── env.ts                           # Environment variable validation
│   └── logger.ts                        # Structured JSON logger
├── middleware.ts                          # Rate limiting + OpenClaw auth
├── services/
│   ├── scout.service.ts
│   ├── intel.service.ts
│   ├── builder.service.ts
│   ├── outreach.service.ts
│   ├── closer.service.ts
│   └── payment.service.ts
├── templates/
│   └── base.ts                          # HTML templates (restaurant/plumber/generic)
└── workers/
    ├── scout.worker.ts
    ├── intel.worker.ts
    ├── builder.worker.ts
    ├── outreach.worker.ts
    ├── closer.worker.ts
    └── scheduler.worker.ts

worker.ts                                 # BullMQ worker entry point
prisma/
├── schema.prisma                        # Full DB schema (8 tables)
└── seed.ts                              # Seed script with fake data
docker-compose.yml                        # Local Postgres + Redis
```

## Development Phases (all complete)

| Phase | Name | What It Does |
|-------|------|-------------|
| 1 | Core Scaffolding | Next.js project, Prisma schema, BullMQ setup, dashboard shell |
| 2 | Scout Agent | Google Places integration, lead discovery pipeline |
| 3 | Intel Agent | LLM business research, lead scoring |
| 4 | Builder Agent | HTML template system, Cloudflare Pages deploy |
| 5 | Outreach Agent | Email sequences via Resend, follow-up scheduling |
| 6 | Payment Integration | Stripe Payment Links, webhook-driven completion |
| 7 | Closer Agent | Reply classification, AI objection handling |
| 8 | OpenClaw Integration | External API, chat intent parsing, scheduler |
| 9 | Real-time + Polish | SSE, error boundaries, loading states, rate limiting, API hardening |

## Cost Estimate (MVP)

| Service | Monthly Cost |
|---------|-------------|
| Railway (hobby) | ~$5 |
| OpenRouter LLM usage | ~$10-30 |
| Google Places API | Free ($200 credit) |
| Resend | Free (3k emails/mo) |
| Stripe | 2.9% + $0.30 per sale |
| Cloudflare Pages | Free (unlimited sites) |
| **Total** | **~$15-35/mo** |
