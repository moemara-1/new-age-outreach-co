"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
      <div className="bg-[#111] rounded-xl p-8 max-w-md text-center">
        <div className="text-4xl mb-4">⚠</div>
        <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-[#999] mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="bg-[#252525] hover:bg-[#333] text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
