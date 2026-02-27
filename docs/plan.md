# MAX Lead Generation System — Implementation Plan

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Backend + Frontend | TypeScript + Next.js 15 (App Router) | One language everywhere. Real-time dashboard + API routes + workers. |
| ORM | Prisma 6 | Type-safe, migration system, works great with Next.js |
| DB | PostgreSQL (Railway managed) | Reliable, free tier, scales well |
| Queue | BullMQ + Redis (Railway) | Background jobs for scraping, emails, site generation |
| Hosting | Railway (~$5/mo) | Runs persistent workers + Postgres + Redis in one platform |
| Demo sites | Cloudflare Pages (free) | Static HTML deploy via API, global CDN, unlimited sites |
| Email | Resend (3k/mo free) | Modern API, React Email templates, good DX |
| Payment | Stripe Payment Links | Simplest path to payment, webhook-driven |
| LLM | OpenRouter (multi-model) | MiniMax for HTML gen, DeepSeek free for intel/outreach/classify, Claude Sonnet for closing. One API, best model per task. |
| Lead source | Google Maps Places API ($200/mo free credit) | Search by category + location, filter no-website businesses |
| Telegram | Through OpenClaw only | MAX exposes HTTP API. OpenClaw calls it. |
| Styling | Tailwind CSS v4, dark theme | Matches the .pen UI design |

## Architecture

```
User <-> Telegram <-> OpenClaw Bot <-> MAX HTTP API <-> MAX Services
User <-> Dashboard (Next.js) -------> MAX HTTP API <-> MAX Services
                                                   <-> BullMQ Workers
                                                   <-> PostgreSQL + Redis
```

Two processes in production:
1. `next start` — dashboard + API
2. `tsx worker.ts` — BullMQ background jobs

## Database Tables

`campaigns`, `businesses`, `leads`, `demo_sites`, `outreach_messages`, `payments`, `agent_runs`, `activity_log`

Full schema in `prisma/schema.prisma`.

---

## Phases

### Phase 1: Core Scaffolding + Dashboard Shell ✅
- [x] Next.js 15 project with Tailwind v4, Prisma 6, BullMQ
- [x] Full Prisma schema (8 tables) + client generation
- [x] docker-compose.yml for local Postgres + Redis
- [x] .env.example with all required vars
- [x] Core lib: db.ts, redis.ts, env.ts, logger.ts
- [x] Dashboard UI matching .pen design: 6 agent cards, activity feed, chat input, top bar with stats
- [x] API routes: stats, activity, agents, campaigns, leads, chat, webhooks
- [x] Seed script with fake data
- [x] BullMQ queue definitions + worker entry point + 6 placeholder workers

### Phase 2: Scout Agent (Lead Discovery) ✅
- [x] Google Places API client (`src/integrations/maps/places.ts`) — Text Search, pagination, field masks
- [x] `src/services/scout.service.ts` — orchestrates search, filter, upsert, activity logging
- [x] `src/workers/scout.worker.ts` — full BullMQ worker with agent_run status tracking
- [x] Search businesses by location + category, filter no-website
- [x] Store in `businesses` + `leads`, log to `activity_log`
- [x] Campaign creation UI (`/campaigns`) + wired agent run API (enqueues BullMQ jobs)
- [x] Dashboard page now fetches real stats + activity from DB (force-dynamic)

### Phase 3: Intel Agent (Business Research) ✅
- [x] LLM client — Claude API via `@anthropic-ai/sdk`, Sonnet/Opus model switching (`src/integrations/llm/claude.ts`)
- [x] `generateText()` + `generateJSON<T>()` with structured output parsing
- [x] Intel service + worker — LLM profiles business, scores lead 0-100, stores profileJson
- [x] Lead list page (`/leads`) with status, score, rating, demo site columns
- [x] Lead detail page (`/leads/[id]`) with business details, AI analysis, outreach history, payment info

### Phase 4: Builder Agent (Demo Site Generation) ✅
- [x] HTML template system (`src/templates/base.ts`) — restaurant/plumber/generic, responsive, accent color per vertical
- [x] LLM generates copy via MiniMax M1 (builder-copy task) — headline, about, services, CTA
- [x] Builder service + worker — generates copy, fills template, upserts demo_sites, updates lead status
- [x] Cloudflare Pages deploy client (`src/integrations/deploy/cloudflare.ts`) — auto-creates project, direct upload API
- [x] Category-to-template mapping for auto-selection

### Phase 5: Outreach Agent (Email Sequences) ✅
- [x] Resend client (`src/integrations/email/resend.ts`) — send with tags for webhook matching
- [x] Outreach service (`src/services/outreach.service.ts`) — LLM-generated personalized emails with demo site link
- [x] Outreach worker (`src/workers/outreach.worker.ts`) — full BullMQ worker, concurrency 5, agentRun tracking
- [x] Follow-up scheduler — auto-enqueues FOLLOW_UP_1/2/3 as delayed BullMQ jobs (day 3, 7, 14) after initial send
- [x] Email webhook handler (`/api/webhooks/email`) — Svix signature verification, tracks opens/clicks/bounces/complaints
- [x] Schema: `resendId` on OutreachMessage for webhook→message matching
- [x] Env: `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL` added

### Phase 6: Payment Integration ✅
- [x] Stripe client (`src/integrations/payment/stripe.ts`) — creates product+price+Payment Link with lead_id metadata
- [x] Payment service (`src/services/payment.service.ts`) — creates payment link, stores Payment record, marks complete on webhook
- [x] Stripe webhook (`/api/webhooks/stripe`) — signature verification, handles checkout.session.completed → CLOSED_WON
- [x] Payment API route (`/api/leads/[id]/payment`) — POST to create payment link for a lead ($499 default)
- [x] Lead detail page — shows payment link button when unpaid, hides when paid

### Phase 7: Closer Agent (AI Objection Handling) ✅
- [x] Inbound reply webhook (`/api/webhooks/email/inbound`) — extracts lead_id from reply-to address, enqueues closer job
- [x] Closer service (`src/services/closer.service.ts`) — classifies reply (DeepSeek), generates contextual response (Claude Sonnet 4)
- [x] Closer worker (`src/workers/closer.worker.ts`) — classify → generate reply → auto-send or draft, concurrency 3
- [x] Reply classification: INTERESTED → payment link, OBJECTION → address concerns, QUESTION → answer, NOT_INTERESTED → graceful exit
- [x] Auto-send configurable via `CLOSER_AUTO_REPLY` env (default: false = draft for manual approval)
- [x] Updates lead status based on classification (INTERESTED/OBJECTION/REPLIED/CLOSED_LOST)

### Phase 8: OpenClaw Integration + Growth ✅
- [x] OpenClaw webhook client (`src/integrations/openclaw/client.ts` + `notify.ts`) — fire-and-forget event notifications
- [x] OpenClaw HTTP API (`/api/openclaw/`) — campaigns, stats, leads, leads/[id]/action — all authenticated via x-api-key
- [x] Event notifications wired into: scout (lead.found), outreach (lead.contacted), closer (lead.replied/interested/closed_lost), payment (lead.closed_won)
- [x] Chat endpoint (`/api/chat`) — LLM-powered intent parsing → agent routing (scout, intel, builder, outreach, stats, status)
- [x] ChatInput component wired to POST /api/chat with Enter key support and response display
- [x] Scheduler worker (`src/workers/scheduler.worker.ts`) — repeatable job every 6h, re-engages stalled leads + triggers follow-ups for opened-no-reply

### Phase 9: Real-time + Polish
- [ ] Server-Sent Events for live activity feed
- [ ] Error boundaries, loading states, rate limiting
- [ ] Production hardening

---

## Cost Estimate (MVP)

~$5/mo (Railway hobby) + ~$10-30/mo Claude API usage. Everything else has generous free tiers.
