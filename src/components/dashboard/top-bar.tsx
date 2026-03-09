"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { StatusDot } from "@/components/ui/badge";

type Stats = {
  found: number;
  built: number;
  sent: number;
  replied: number;
};

type Campaign = {
  id: string;
  name: string;
};

export function TopBar({ stats }: { stats: Stats }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const searchParams = useSearchParams();
  const activeCampaignId = searchParams.get("campaignId");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data));
  }, []);

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId);

  async function handleControl(action: "pause" | "resume" | "stop" | "clear") {
    if (action === "pause") setIsPaused(true);
    if (action === "resume") setIsPaused(false);
    if (action === "stop") setIsPaused(false);
    await fetch("/api/system/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "clear") {
      window.location.reload();
    }
  }

  return (
    <div className="flex items-center justify-between h-14 px-6 bg-[#0C0C0C] shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[22px] font-extrabold italic text-white tracking-tight">
          NEW AGE
        </span>
        <div className="relative group z-50">
          <button className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#252525] rounded-md px-3.5 py-1.5 text-sm font-medium text-white transition-colors">
            {activeCampaign ? activeCampaign.name : "All Campaigns"}
            <span className="text-[#666] text-base">⌄</span>
          </button>
          {campaigns.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#161616] border border-[#2A2A2A] rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="py-1">
                <Link
                  href="/"
                  className="block px-4 py-2 text-sm text-[#ccc] hover:bg-[#252525] hover:text-white"
                >
                  All Campaigns
                </Link>
                {campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/?campaignId=${c.id}`}
                    className="block px-4 py-2 text-sm text-[#ccc] hover:bg-[#252525] hover:text-white"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link href="/campaigns" className="flex items-center gap-1 bg-[#1A1A1A] hover:bg-[#252525] rounded-md px-3.5 py-1.5 text-sm font-medium text-white transition-colors">
          + New
        </Link>
      </div>

      <div className="flex items-center gap-5">
        <Stat dot="green" label={`${stats.found} FOUND`} />
        <Stat dot="red" label={`${stats.built} BUILT`} />
        <Stat dot="green" label={`${stats.sent} SENT`} />
        <Stat dot="red" label={`${stats.replied} REPLIED`} />

        <button
          onClick={() => handleControl(isPaused ? "resume" : "pause")}
          className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#252525] rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-colors"
        >
          {isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to stop all active background agents? This will clear all pending jobs in the queue.")) {
              handleControl("stop");
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-red-500 hover:bg-[#252525]/50 border border-transparent transition-colors"
        >
          <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
          Stop
        </button>
        <button
          onClick={() => {
            if (confirm("Clear all logs, activity, and agent run history? Leads and campaigns will be kept.")) {
              handleControl("clear");
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-[#999] hover:text-white hover:bg-[#252525]/50 transition-colors"
        >
          🗑 Clear
        </button>
      </div>
    </div>
  );
}

function Stat({ dot, label }: { dot: "green" | "red"; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <StatusDot color={dot} />
      <span className="text-xs font-semibold text-[#999] tracking-wide">{label}</span>
    </div>
  );
}
