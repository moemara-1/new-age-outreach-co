"use client";

import { useState } from "react";
import { ActivitySidebar } from "./activity-feed";

type ActivityEntry = {
    id: string;
    agent: string;
    time: string;
    title: string;
    subtitle?: string;
};

export function ActivityModal({ entries }: { entries: ActivityEntry[] }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className="fixed bottom-6 right-6 z-50 bg-[#1A1A1A] border border-[#333] hover:bg-[#252525] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold transition-all hover:scale-105"
            >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                Live Logs
            </button>

            {open && (
                <div className="fixed top-0 right-0 h-full w-80 shadow-2xl z-40 animate-in slide-in-from-right duration-300">
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            onClick={() => setOpen(false)}
                            className="text-[#666] hover:text-white bg-[#1A1A1A] rounded-full w-6 h-6 flex items-center justify-center border border-[#333]"
                        >
                            ✕
                        </button>
                    </div>
                    <ActivitySidebar entries={entries} />
                </div>
            )}
        </>
    );
}
