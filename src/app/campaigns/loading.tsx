export default function CampaignsLoading() {
  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="h-8 w-40 bg-[#111] rounded animate-pulse mb-6" />

        <div className="flex gap-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-[#161616] rounded-lg flex-1 animate-pulse" />
          ))}
          <div className="h-10 w-24 bg-[#252525] rounded-lg animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[#111] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
