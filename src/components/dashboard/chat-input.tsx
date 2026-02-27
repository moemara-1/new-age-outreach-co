"use client";

import { useState } from "react";

export function ChatInput() {
  const [value, setValue] = useState("");

  return (
    <div className="flex justify-center py-3 pb-4 shrink-0">
      <div className="flex items-center justify-between bg-[#161616] rounded-3xl px-4 py-2.5 w-[440px]">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🦀</span>
          <input
            type="text"
            placeholder="Ask anything..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[#555] outline-none w-64"
          />
        </div>
        <button className="w-7 h-7 rounded-full bg-[#252525] flex items-center justify-center text-sm font-semibold text-[#888]">
          ↑
        </button>
      </div>
    </div>
  );
}
