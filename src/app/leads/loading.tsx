export default function LeadsLoading() {
  return (
    <div className="min-h-screen bg-[#0C0C0C] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-8 w-32 bg-[#111] rounded animate-pulse mb-6" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-[#111] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
