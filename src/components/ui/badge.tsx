type BadgeProps = {
  color: "green" | "red" | "yellow" | "gray";
  children: React.ReactNode;
};

const colors = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  gray: "bg-gray-500",
} as const;

export function StatusDot({ color }: { color: BadgeProps["color"] }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[color]}`} />;
}

export function CountBadge({ count }: { count: number }) {
  return (
    <span className="bg-[#1A1A1A] text-[#999] text-[11px] font-semibold px-2 py-0.5 rounded-xl">
      {count}
    </span>
  );
}
