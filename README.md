# OpenClaw AI Agency Pipeline

![OpenClaw Dashboard UI](./public/screenshot.png)
*(Please add your dashboard screenshot to `public/screenshot.png`)*

An end-to-end, fully autonomous AI web agency pipeline that scouts for local businesses, deeply researches their digital presence, generates premium demo websites, and runs personalized cold email outreach—all powered by modern LLMs and web scraping.

## ✨ Core Capabilities

- **Autonomous Lead Generation**: Scrapes Google Maps to find local businesses without websites.
- **Deep Digital Intel**: Multi-query web research extracting real emails, Egyptian/international phone numbers, social media links, and even restaurant menus.
- **Premium Website Generation**: Uses MiniMax M2.5 to programmatically generate stunning, single-page HTML websites featuring CSS animations, glass morphism, Unsplash photography, and Google Fonts.
- **Aggressive Junk Filtering**: Automatically filters out 50+ common junk email domains to ensure high deliverability.
- **Hyper-Personalized Outreach**: AI writes cold emails referencing the exact rating, reviews, and missing digital assets of the business.
- **Real-Time Dashboard**: Monitor all 5 BullMQ AI agents in real-time as they scout, research, build, and email.

## 🚀 The Pipeline

The system is built on an orchestrated series of independent AI workers powered by **BullMQ** and **Redis**.

### 1. 🦀 Scout Agent
- Scrapes **Google Maps** (via Places API) for target businesses (e.g., "Restaurants in New Cairo").
- Extracts ratings, review counts, physical addresses, categories, and identifies if they have an existing website.
- Saves high-potential targets as `NEW` leads.

### 2. 🧠 Intel Agent
- Performs **deep web research** using our self-hosted **SearXNG** instance.
- Runs multi-targeted queries (General, Contact, Social, Menu/Services).
- Aggressively extracts real contact **emails** (filtering 50+ junk domains) and **phone numbers** (parsing Egyptian and international formats).
- Discovers social media presence (Facebook, Instagram, Yelp, TripAdvisor, TikTok).
- Uses a powerful LLM to synthesize this data into a comprehensive business profile (Strengths, Weaknesses, Opportunities, Score).

### 3. 🏗️ Builder Agent
- Powered by **MiniMax M2.5** (via OpenRouter), optimized for long-context premium coding.
- Uses the deep Intel profile to dynamically generate a **stunning, animated, single-page HTML website**.
- Implements modern design trends: CSS keyframe animations, IntersectionObserver scroll fade-ins, glass morphism, and Google Fonts.
- Fills the site with real data (menu items, reviews, actual contact info) and relevant placeholder Unsplash photography.

### 4. ✉️ Outreach Agent
- Writes highly personalized cold emails referencing specific Intel data points (e.g., "I saw your 4.7-star rating but noticed you lack a modern menu...").
- Sends emails automatically via **Resend**.
- Sets up inbound webhooks to track Opens, Clicks, and Replies.

### 5. 🤝 Closer Agent
- Listens for inbound email replies from business owners.
- Acts as a sales representative ("Max") to handle objections, answer questions, and steer the prospect toward purchasing the site.
- (Optional) Integrates with **Stripe** to send payment links.

## 💻 Tech Stack

- **Framework**: Next.js 14 / TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Queues**: BullMQ + Redis
- **LLM APIs**: OpenRouter (Llama 3, Qwen, MiniMax 2.5), Groq
- **Email**: Resend
- **Search Engine**: SearXNG (Dockerized)
- **Maps**: Google Places API

## 🛠️ Setup & Installation

### 1. Prerequisites
You will need Node.js, an active PostgreSQL database, and Docker (for Redis & SearXNG).

### 2. Environment Variables
Create a `.env` file in the root based on `.env.example`:
\`\`\`env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/openclaw"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# External APIs
OPENROUTER_API_KEY="..."
GROQ_API_KEY="..."
GOOGLE_MAPS_API_KEY="..."

# Email
RESEND_API_KEY="..."
RESEND_FROM_EMAIL="max@yourdomain.com"
RESEND_WEBHOOK_SECRET="..."

# Web Search
SEARXNG_URL="http://localhost:8080"
\`\`\`

### 3. Install Services

Start a local Redis instance:
\`\`\`bash
docker run -d --name redis -p 6379:6379 redis
\`\`\`

Start the local SearXNG instance (with JSON API enabled):
\`\`\`bash
docker run -d --name searxng -p 8080:8080 -e SEARXNG_SECRET=$(openssl rand -hex 16) searxng/searxng
# You must ensure 'json' format is enabled in SearXNG settings.yml for the Intel agent to work.
\`\`\`

### 4. Install Dependencies & DB Setup
\`\`\`bash
npm install
npx prisma generate
npx prisma db push
\`\`\`

### 5. Run the System
The system requires both the Next.js web application and the background BullMQ workers to run simultaneously.

\`\`\`bash
# Starts both Next.js and the Workers
npm run dev:all
\`\`\`

Alternatively, run them in separate terminals:
\`\`\`bash
npm run dev        # Starts Next.js interface at localhost:3000
npm run worker     # Starts the background job processors
\`\`\`

## 🎮 Usage

1. Open `http://localhost:3000`
2. Open the Chat Interface (bottom right)
3. Say: \`"Find restaurants in Alexandria"\` (Triggers Scout)
4. Once Scout finishes, say: \`"Run the pipeline"\`
5. Watch the dashboard as Intel researches, Builder designs, and Outreach sends emails!

## 🔧 Dashboard Controls
- **Pause/Resume**: Pauses the workers without losing the queue.
- **Stop**: Pauses the workers and drains the queue (cancels pending jobs).
- **Clear**: Wipes the Activity Log, Agent Runs, and flushes remaining Redis jobs (keeps Campaigns and Leads intact).

---
*Built for the Zero Human Company Project.*