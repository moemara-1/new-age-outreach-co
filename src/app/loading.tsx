export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-screen">
      <div className="h-14 bg-[#111] border-b border-[#1A1A1A] animate-pulse" />

      <div className="flex flex-1 min-h-0">
        <main className="flex flex-col flex-1 min-w-0">
          <div className="h-10 bg-[#0C0C0C] border-b border-[#1A1A1A]" />
          <div className="flex-1 px-15 py-5">
            <div className="flex flex-wrap gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-[260px] h-[170px] bg-[#111] rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="flex flex-wrap gap-8 mt-10">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-[260px] h-[170px] bg-[#111] rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </main>

        <aside className="w-80 bg-[#0C0C0C] border-l border-[#1A1A1A] p-4">
          <div className="h-5 w-24 bg-[#111] rounded animate-pulse mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[#111] rounded-lg animate-pulse mb-1" />
          ))}
        </aside>
      </div>

      <div className="h-14 bg-[#0C0C0C] flex justify-center py-3">
        <div className="w-[440px] h-10 bg-[#161616] rounded-3xl animate-pulse" />
      </div>
    </div>
  );
}
