import Link from "next/link";

export function SubHeader() {
  return (
    <div className="flex items-center gap-2 px-6 py-3">
      <Link
        href="/campaigns"
        className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#252525] transition-colors"
      >
        <span>☰</span>
        <span>Campaigns</span>
      </Link>
      <Link
        href="/leads"
        className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#252525] transition-colors"
      >
        <span>👥</span>
        <span>Leads</span>
      </Link>
      <Link
        href="/logs"
        className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#252525] transition-colors"
      >
        <span>📋</span>
        <span>Logs</span>
      </Link>
      <Link href="/settings" className="flex items-center bg-[#1A1A1A] rounded-md px-2.5 py-2 text-base text-[#999] hover:bg-[#252525] hover:text-white transition-colors">
        ⚙
      </Link>
    </div>
  );
}
