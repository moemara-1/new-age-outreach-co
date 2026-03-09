export const dynamic = "force-dynamic";

import { TopBar } from "@/components/dashboard/top-bar";
import { AgentGrid } from "@/components/dashboard/agent-grid";
import { ActivitySidebar } from "@/components/dashboard/activity-feed";
import { ChatInput } from "@/components/dashboard/chat-input";
import { SubHeader } from "@/components/dashboard/sub-header";
import { db } from "@/lib/db";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const params = await searchParams;
  const campaignId = params.campaignId;

  const [statsData, activityData] = await Promise.all([
    Promise.all([
      db.lead.count({ where: campaignId ? { campaignId } : undefined }),
      db.demoSite.count({ where: campaignId ? { lead: { campaignId } } : undefined }),
      db.outreachMessage.count({ where: { sentAt: { not: null }, ...(campaignId && { lead: { campaignId } }) } }),
      db.outreachMessage.count({ where: { repliedAt: { not: null }, ...(campaignId && { lead: { campaignId } }) } }),
    ]),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const stats = {
    found: statsData[0],
    built: statsData[1],
    sent: statsData[2],
    replied: statsData[3],
  };

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
          <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-10 py-6 gap-8">
            <AgentGrid />
          </div>
        </main>

        <ActivitySidebar entries={activity} />
      </div>

      <ChatInput />
    </div>
  );
}
