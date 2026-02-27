"use client";

import { useState } from "react";

export function ChatInput() {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const msg = value.trim();
    if (!msg || loading) return;

    setLoading(true);
    setReply("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setReply(data.reply ?? "No response.");
      setValue("");
    } catch {
      setReply("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center py-3 pb-4 shrink-0 gap-2">
      {reply && (
        <div className="bg-[#1A1A1A] text-sm text-[#ccc] rounded-xl px-4 py-2.5 w-[440px]">
          {reply}
        </div>
      )}
      <div className="flex items-center justify-between bg-[#161616] rounded-3xl px-4 py-2.5 w-[440px]">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🦀</span>
          <input
            type="text"
            placeholder="Ask anything..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={loading}
            className="bg-transparent text-sm text-white placeholder-[#555] outline-none w-64 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="w-7 h-7 rounded-full bg-[#252525] flex items-center justify-center text-sm font-semibold text-[#888] hover:bg-[#333] disabled:opacity-30 transition-colors"
        >
          {loading ? "·" : "↑"}
        </button>
      </div>
    </div>
  );
}
