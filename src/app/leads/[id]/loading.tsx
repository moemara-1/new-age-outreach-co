export default function LeadDetailLoading() {
  return (
    <div className="min-h-screen bg-[#0C0C0C] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="h-5 w-20 bg-[#111] rounded animate-pulse mb-6" />

        <div className="flex items-center gap-4 mb-8">
          <div className="h-8 w-64 bg-[#111] rounded animate-pulse" />
          <div className="h-6 w-20 bg-[#1A1A1A] rounded-full animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-[#111] rounded-xl p-6 h-48 animate-pulse" />
          <div className="bg-[#111] rounded-xl p-6 h-48 animate-pulse" />
        </div>

        <div className="bg-[#111] rounded-xl p-6 h-64 animate-pulse mb-6" />
        <div className="bg-[#111] rounded-xl p-6 h-40 animate-pulse" />
      </div>
    </div>
  );
}
