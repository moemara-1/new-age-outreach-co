"use client";

import { useEffect, useRef, useState } from "react";
import { CountBadge } from "@/components/ui/badge";

type ActivityEntry = {
  id: string;
  agent: string;
  time: string;
  title: string;
  subtitle?: string;
};

export function ActivitySidebar({ entries: initial }: { entries: ActivityEntry[] }) {
  const [entries, setEntries] = useState<ActivityEntry[]>(initial);
  const seenIds = useRef(new Set(initial.map((e) => e.id)));

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let backoff = 2000;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource("/api/activity/stream");

      es.onmessage = (event) => {
        backoff = 2000;
        try {
          const entry: ActivityEntry = JSON.parse(event.data);
          if (seenIds.current.has(entry.id)) return;
          seenIds.current.add(entry.id);
          setEntries((prev) => [entry, ...prev].slice(0, 100));
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es?.close();
        if (cancelled) return;
        reconnectTimeout = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeout);
      es?.close();
    };
  }, []);

  return (
    <aside className="w-80 bg-[#0C0C0C] border-l border-[#1A1A1A] flex flex-col shrink-0 h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Activity</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-[#666]">Live</span>
        </div>
        <CountBadge count={entries.length} />
      </div>

      <div className="flex flex-col gap-0.5 px-2 overflow-y-auto flex-1">
        {entries.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </div>
    </aside>
  );
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="bg-[#111] rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold font-mono text-[#666]">
          {entry.agent}
        </span>
        <span className="text-[11px] font-mono text-[#444]">{entry.time}</span>
      </div>
      <span className="text-[13px] font-medium text-white">{entry.title}</span>
      {entry.subtitle && (
        <span className="text-[11px] font-mono text-[#555]">{entry.subtitle}</span>
      )}
    </div>
  );
}
