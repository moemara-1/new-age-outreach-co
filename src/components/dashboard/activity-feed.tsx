import { CountBadge } from "@/components/ui/badge";

type ActivityEntry = {
  id: string;
  agent: string;
  time: string;
  title: string;
  subtitle?: string;
  preview?: string;
};

export function ActivitySidebar({ entries }: { entries: ActivityEntry[] }) {
  return (
    <aside className="w-80 bg-[#0C0C0C] border-l border-[#1A1A1A] flex flex-col shrink-0 h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Activity</span>
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
      {entry.preview && (
        <div className="mt-1 rounded-lg bg-[#1A1A1A] h-[120px] overflow-hidden">
          {/* placeholder for demo site preview */}
        </div>
      )}
    </div>
  );
}
