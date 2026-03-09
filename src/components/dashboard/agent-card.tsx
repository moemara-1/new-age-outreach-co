"use client";

import { useState } from "react";

type AgentCardProps = {
  name: string;
  emoji: string;
  status: "idle" | "running" | "error" | "completed";
  statusLabel: string;
  errorMsg?: string;
};

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.substring(0, max) + "…";
}

function extractError(raw: string): string {
  // Try to pull the human-readable part from rate limit errors
  const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  return raw;
}

export function AgentCard({ name, emoji, status, statusLabel, errorMsg }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const dotColor =
    status === "running"
      ? "bg-blue-500 animate-pulse"
      : status === "error"
        ? "bg-red-500"
        : status === "completed"
          ? "bg-green-500"
          : "bg-[#666]";

  return (
    <div
      className={`flex flex-col gap-2 bg-[#161616] rounded-2xl px-4 py-6 w-[260px] min-h-[170px] transition-all ${status === "error" ? "border border-red-500/30" : ""}`}
    >
      <span className="text-[40px] leading-none">{emoji}</span>
      <span className="text-lg font-semibold text-white">{name}</span>
      <div className="flex items-center gap-1.5">
        {status === "running" ? (
          <span className="text-[10px] text-blue-400 animate-spin">○</span>
        ) : (
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        )}
        <span
          className={`text-[13px] ${status === "error" ? "text-red-400 font-medium" : status === "completed" ? "text-green-400" : "text-[#666]"}`}
        >
          {statusLabel}
        </span>
      </div>

      {status === "error" && errorMsg && (
        <div className="mt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-red-400/70 hover:text-red-300 underline cursor-pointer"
          >
            {expanded ? "Hide error ▲" : "Show error ▼"}
          </button>
          {expanded && (
            <div className="mt-1 bg-[#1A1A1A] rounded p-2 text-[11px] text-red-300/80 font-mono break-words leading-relaxed max-h-[120px] overflow-y-auto">
              {truncate(extractError(errorMsg), 300)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
