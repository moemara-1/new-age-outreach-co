export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

type BusinessProfile = {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  suggestedServices?: string[];
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      business: true,
      campaign: true,
      demoSite: true,
      outreachMessages: { orderBy: { createdAt: "desc" } },
      payment: true,
    },
  });

  if (!lead) notFound();

  const biz = lead.business;
  const profile = (lead.profileJson as BusinessProfile | null) ?? {};

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/leads" className="text-sm text-[#666] hover:text-white mb-4 inline-block">
          &larr; All Leads
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{biz.name}</h1>
            <p className="text-[#999] text-sm mt-1">
              {biz.category} &middot; {biz.address}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lead.leadScore !== null && (
              <div className="bg-[#161616] rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold font-mono">{lead.leadScore}</div>
                <div className="text-[10px] text-[#666] uppercase tracking-wider">Score</div>
              </div>
            )}
            <div className="bg-[#161616] rounded-lg px-4 py-2 text-center">
              <div className="text-sm font-semibold">{lead.status.replace("_", " ")}</div>
              <div className="text-[10px] text-[#666] uppercase tracking-wider">Status</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Section title="Business Details">
            <Row label="Phone" value={biz.phone ?? "Not listed"} />
            <Row label="Website" value={biz.website ?? "None"} />
            <Row label="Rating" value={biz.rating ? `${biz.rating.toFixed(1)} (${biz.reviewCount} reviews)` : "N/A"} />
            <Row label="Campaign" value={lead.campaign.name} />
          </Section>

          {profile.summary && (
            <Section title="AI Analysis">
              <p className="text-sm text-[#ccc] mb-3">{profile.summary}</p>
              {profile.strengths && profile.strengths.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-[#666] uppercase tracking-wider">Strengths</span>
                  <ul className="text-sm text-[#ccc] mt-1">
                    {profile.strengths.map((s, i) => <li key={i} className="pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#666]">{s}</li>)}
                  </ul>
                </div>
              )}
              {profile.weaknesses && profile.weaknesses.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-[#666] uppercase tracking-wider">Weaknesses</span>
                  <ul className="text-sm text-[#ccc] mt-1">
                    {profile.weaknesses.map((w, i) => <li key={i} className="pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#666]">{w}</li>)}
                  </ul>
                </div>
              )}
              {profile.opportunities && profile.opportunities.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#666] uppercase tracking-wider">Opportunities</span>
                  <ul className="text-sm text-[#ccc] mt-1">
                    {profile.opportunities.map((o, i) => <li key={i} className="pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#666]">{o}</li>)}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {lead.demoSite && (
            <Section title="Demo Site">
              <Row label="URL" value={lead.demoSite.url} link />
              <Row label="Template" value={lead.demoSite.template} />
              <Row label="Generated" value={lead.demoSite.generatedAt.toLocaleDateString()} />
            </Section>
          )}

          {lead.outreachMessages.length > 0 && (
            <Section title="Outreach History">
              {lead.outreachMessages.map((msg) => (
                <div key={msg.id} className="mb-3 pb-3 border-b border-[#1A1A1A] last:border-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#999] font-mono">{msg.type.replace("_", " ")}</span>
                    <span className="text-[#666]">{msg.sentAt?.toLocaleDateString() ?? "Draft"}</span>
                  </div>
                  <div className="text-sm font-medium text-[#ccc]">{msg.subject}</div>
                  {msg.openedAt && <span className="text-[10px] text-green-500 mr-2">Opened</span>}
                  {msg.clickedAt && <span className="text-[10px] text-blue-400 mr-2">Clicked</span>}
                  {msg.repliedAt && <span className="text-[10px] text-emerald-400">Replied</span>}
                </div>
              ))}
            </Section>
          )}

          {lead.payment && (
            <Section title="Payment">
              <Row label="Amount" value={`$${(lead.payment.amount / 100).toFixed(2)} ${lead.payment.currency.toUpperCase()}`} />
              <Row label="Status" value={lead.payment.paid ? "Paid" : "Pending"} />
              {lead.payment.paidAt && <Row label="Paid At" value={lead.payment.paidAt.toLocaleDateString()} />}
              {lead.payment.stripeLinkUrl && !lead.payment.paid && (
                <div className="mt-3">
                  <a
                    href={lead.payment.stripeLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Payment Link &rarr;
                  </a>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111] rounded-lg p-5">
      <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-[#666]">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          {value}
        </a>
      ) : (
        <span className="text-[#ccc]">{value}</span>
      )}
    </div>
  );
}
