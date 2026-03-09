"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AgentCard } from "./agent-card";

type AgentStatus = {
    status: "idle" | "running" | "error" | "completed";
    statusLabel: string;
    error?: string;
};

const AGENTS = [
    { name: "Scout", emoji: "🦀", key: "SCOUT" },
    { name: "Intel", emoji: "🦀", key: "INTEL" },
    { name: "Builder", emoji: "🦀", key: "BUILDER" },
    { name: "Growth", emoji: "🦀", key: "GROWTH" },
    { name: "Closer", emoji: "🦀", key: "CLOSER" },
    { name: "Outreach", emoji: "🦀", key: "OUTREACH" },
] as const;

export function AgentGrid() {
    const searchParams = useSearchParams();
    const campaignId = searchParams.get("campaignId");

    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

    const poll = useCallback(async () => {
        try {
            const url = campaignId
                ? `/api/dashboard/agents?campaignId=${campaignId}`
                : "/api/dashboard/agents";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setAgentStatuses(data.agents ?? {});
            }
        } catch {
            // Silently fail polling
        }
    }, [campaignId]);

    useEffect(() => {
        poll(); // Initial fetch
        const interval = setInterval(poll, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [poll]);

    // Reset when campaign changes
    useEffect(() => {
        setAgentStatuses({});
        poll();
    }, [campaignId, poll]);

    return (
        <>
            <div className="flex gap-6">
                {AGENTS.slice(0, 3).map((a) => {
                    const s = agentStatuses[a.key];
                    return (
                        <AgentCard
                            key={a.name}
                            name={a.name}
                            emoji={a.emoji}
                            status={s?.status ?? "idle"}
                            statusLabel={s?.statusLabel ?? "Idle"}
                            errorMsg={s?.error}
                        />
                    );
                })}
            </div>
            <div className="flex gap-6">
                {AGENTS.slice(3).map((a) => {
                    const s = agentStatuses[a.key];
                    return (
                        <AgentCard
                            key={a.name}
                            name={a.name}
                            emoji={a.emoji}
                            status={s?.status ?? "idle"}
                            statusLabel={s?.statusLabel ?? "Idle"}
                            errorMsg={s?.error}
                        />
                    );
                })}
            </div>
        </>
    );
}
