"use client";

import { useState } from "react";
import type { OutreachMessage } from "@prisma/client";

export function OutreachButton({ messages }: { messages: OutreachMessage[] }) {
    const [open, setOpen] = useState(false);

    if (!messages || messages.length === 0) {
        return <span className="text-[#444] text-xs">No outreach</span>;
    }

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className="text-green-400 hover:text-green-300 text-xs font-medium cursor-pointer"
            >
                {messages.length} Email(s) Sent ↗
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
                    <div
                        className="bg-[#161616] rounded-xl border border-[#2A2A2A] max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Outreach History</h3>
                            <button onClick={() => setOpen(false)} className="text-[#666] hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6">
                            {messages.map((msg, i) => (
                                <div key={msg.id} className="bg-[#111] border border-[#222] rounded-lg overflow-hidden">
                                    <div className="bg-[#1A1A1A] px-4 py-3 border-b border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs font-medium border border-green-500/20">
                                                {msg.type.replace("_", " ")}
                                            </span>
                                            <span className="text-[#888] text-xs">
                                                {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : "Unknown"}
                                            </span>
                                        </div>
                                        {msg.openedAt && (
                                            <span className="text-blue-400 text-xs flex items-center gap-1">
                                                <span>👁</span> Opened {new Date(msg.openedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="text-sm text-[#888] mb-1">To: <span className="text-[#ccc]">{(msg as any).to || "Unknown"}</span></div>
                                        <div className="text-sm text-[#888] mb-4">Subject: <span className="text-white font-medium">{msg.subject}</span></div>

                                        <div className="pt-4 border-t border-[#222]">
                                            <div
                                                className="prose prose-sm prose-invert max-w-none text-[#ccc]"
                                                dangerouslySetInnerHTML={{ __html: msg.body }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setOpen(false)}
                            className="w-full mt-6 py-2.5 bg-[#252525] hover:bg-[#333] rounded-lg text-sm text-white font-medium transition-colors border border-[#3A3A3A]"
                        >
                            Close Preview
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
