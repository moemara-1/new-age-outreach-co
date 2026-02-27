export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-500",
  RESEARCHED: "bg-blue-500",
  SITE_BUILT: "bg-purple-500",
  CONTACTED: "bg-yellow-500",
  REPLIED: "bg-green-500",
  INTERESTED: "bg-emerald-500",
  OBJECTION: "bg-orange-500",
  CLOSED_WON: "bg-green-400",
  CLOSED_LOST: "bg-red-500",
  UNSUBSCRIBED: "bg-gray-400",
};

export default async function LeadsPage() {
  const leads = await db.lead.findMany({
    include: { business: true, demoSite: true, campaign: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Leads</h1>
          <Link href="/" className="text-sm text-[#666] hover:text-white">
            &larr; Dashboard
          </Link>
        </div>

        <div className="bg-[#111] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222] text-[#999] text-left">
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Demo Site</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-[#1A1A1A] hover:bg-[#161616]">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="text-white hover:underline font-medium">
                      {lead.business.name}
                    </Link>
                    <div className="text-[#666] text-xs mt-0.5">{lead.business.address}</div>
                  </td>
                  <td className="px-4 py-3 text-[#999]">{lead.campaign.name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-500"}`} />
                      <span className="text-[#ccc]">{lead.status.replace("_", " ")}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#ccc] font-mono">{lead.leadScore ?? "—"}</td>
                  <td className="px-4 py-3 text-[#ccc]">
                    {lead.business.rating ? `${lead.business.rating.toFixed(1)} (${lead.business.reviewCount})` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {lead.demoSite ? (
                      <a href={lead.demoSite.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">
                        View
                      </a>
                    ) : (
                      <span className="text-[#444]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#555]">
                    No leads yet. Create a campaign to start finding leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
