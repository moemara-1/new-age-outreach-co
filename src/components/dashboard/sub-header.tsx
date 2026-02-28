export function SubHeader() {
  return (
    <div className="flex items-center gap-2 px-6 py-3">
      <a
        href="/campaigns"
        className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3.5 py-2 text-[13px] font-medium text-white"
      >
        <span>☰</span>
        <span>Campaigns</span>
      </a>
      <button className="flex items-center bg-[#1A1A1A] rounded-md px-2.5 py-2 text-base text-[#999]">
        ⚙
      </button>
    </div>
  );
}
