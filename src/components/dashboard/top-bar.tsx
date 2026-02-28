"use client";

import { StatusDot } from "@/components/ui/badge";

type Stats = {
  found: number;
  built: number;
  sent: number;
  replied: number;
};

export function TopBar({ stats }: { stats: Stats }) {
  return (
    <div className="flex items-center justify-between h-14 px-6 bg-[#0C0C0C] shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[22px] font-extrabold italic text-white tracking-tight">
          NEW AGE
        </span>
        <button className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3.5 py-1.5 text-sm font-medium text-white">
          demo
          <span className="text-[#666] text-base">⌄</span>
        </button>
        <button className="flex items-center gap-1 bg-[#1A1A1A] rounded-md px-3.5 py-1.5 text-sm font-medium text-white">
          + New
        </button>
      </div>

      <div className="flex items-center gap-5">
        <Stat dot="green" label={`${stats.found} FOUND`} />
        <Stat dot="red" label={`${stats.built} BUILT`} />
        <Stat dot="green" label={`${stats.sent} SENT`} />
        <Stat dot="red" label={`${stats.replied} REPLIED`} />

        <button className="flex items-center gap-1.5 bg-[#1A1A1A] rounded-md px-4 py-2 text-[13px] font-semibold text-white">
          ⏸ Pause
        </button>
        <button className="flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-red-500 border border-transparent">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
          Stop
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
