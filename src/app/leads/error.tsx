"use client";

import Link from "next/link";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
      <div className="bg-[#111] rounded-xl p-8 max-w-md text-center">
        <h2 className="text-lg font-semibold text-white mb-2">Failed to load leads</h2>
        <p className="text-sm text-[#999] mb-6">
          {error.message || "Could not fetch leads."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-[#252525] hover:bg-[#333] text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Retry
          </button>
          <Link
            href="/"
            className="bg-[#1A1A1A] hover:bg-[#252525] text-[#999] text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
