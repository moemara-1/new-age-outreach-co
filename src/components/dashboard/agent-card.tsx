type AgentCardProps = {
  name: string;
  emoji: string;
  status: "idle" | "running" | "error";
  statusLabel: string;
};

export function AgentCard({ name, emoji, status, statusLabel }: AgentCardProps) {
  return (
    <div className="flex flex-col gap-2 bg-[#161616] rounded-2xl p-6 w-[260px] h-[170px]">
      <span className="text-[40px] leading-none">{emoji}</span>
      <span className="text-lg font-semibold text-white">{name}</span>
      <div className="flex items-center gap-1.5">
        {status === "idle" ? (
          <span className="w-2 h-2 rounded-full bg-[#666]" />
        ) : status === "running" ? (
          <span className="text-[10px] text-[#666] animate-spin">○</span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-red-500" />
        )}
        <span className="text-[13px] text-[#666]">{statusLabel}</span>
      </div>
    </div>
  );
}
