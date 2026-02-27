export const dynamic = "force-dynamic";

import { TopBar } from "@/components/dashboard/top-bar";
import { AgentCard } from "@/components/dashboard/agent-card";
import { ActivitySidebar } from "@/components/dashboard/activity-feed";
import { ChatInput } from "@/components/dashboard/chat-input";
import { SubHeader } from "@/components/dashboard/sub-header";
import { db } from "@/lib/db";

const AGENTS = [
  { name: "Scout", emoji: "🦀", key: "SCOUT", idleLabel: "Finding leads" },
  { name: "Intel", emoji: "🦀", key: "INTEL", idleLabel: "Auditing site" },
  { name: "Builder", emoji: "🦀", key: "BUILDER", idleLabel: "Building demo" },
  { name: "Growth", emoji: "🦀", key: "GROWTH", idleLabel: "Idle" },
  { name: "Closer", emoji: "🦀", key: "CLOSER", idleLabel: "Writing script" },
  { name: "Outreach", emoji: "🦀", key: "OUTREACH", idleLabel: "Sending email" },
] as const;

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

export default async function DashboardPage() {
  const [statsData, activityData, agentRuns] = await Promise.all([
    Promise.all([
      db.lead.count(),
      db.demoSite.count(),
      db.outreachMessage.count({ where: { sentAt: { not: null } } }),
      db.outreachMessage.count({ where: { repliedAt: { not: null } } }),
    ]),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.agentRun.findMany({
      where: { status: "RUNNING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const stats = {
    found: statsData[0],
    built: statsData[1],
    sent: statsData[2],
    replied: statsData[3],
  };

  const runningAgents = new Set(agentRuns.map((r) => r.agent));

  const agents = AGENTS.map((a) => ({
    name: a.name,
    emoji: a.emoji,
    status: (runningAgents.has(a.key) ? "running" : "idle") as "running" | "idle",
    statusLabel: runningAgents.has(a.key) ? a.idleLabel : "Idle",
  }));

  const activity = activityData.map((e) => ({
    id: e.id,
    agent: e.agent.toLowerCase(),
    time: formatTime(e.createdAt),
    title: e.title,
    subtitle: e.subtitle ?? undefined,
  }));

  return (
    <div className="flex flex-col h-screen">
      <TopBar stats={stats} />

      <div className="flex flex-1 min-h-0">
        <main className="flex flex-col flex-1 min-w-0">
          <SubHeader />
          <div className="flex-1 px-15 py-5 overflow-y-auto">
            <div className="flex flex-wrap gap-8 justify-start">
              {agents.slice(0, 3).map((a) => (
                <AgentCard key={a.name} {...a} />
              ))}
            </div>
            <div className="flex flex-wrap gap-8 justify-start mt-10">
              {agents.slice(3).map((a) => (
                <AgentCard key={a.name} {...a} />
              ))}
            </div>
          </div>
        </main>

        <ActivitySidebar entries={activity} />
      </div>

      <ChatInput />
    </div>
  );
}
