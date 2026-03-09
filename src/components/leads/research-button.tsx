"use client";

import { useState } from "react";

type Profile = {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    score: number;
    suggestedServices: string[];
};

export function ResearchButton({ profileJson }: { profileJson: unknown }) {
    const [open, setOpen] = useState(false);

    if (!profileJson) return <span className="text-[#444] text-xs">No research</span>;

    const profile = profileJson as Profile;

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className="text-blue-400 hover:text-blue-300 text-xs font-medium cursor-pointer"
            >
                {open ? "Hide Research ▲" : "View Research ▼"}
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
                    <div
                        className="bg-[#161616] rounded-xl border border-[#2A2A2A] max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Intel Research</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-white">{profile.score}</span>
                                <span className="text-xs text-[#666]">/ 100</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-[#ccc] text-sm leading-relaxed">{profile.summary}</p>
                        </div>

                        {profile.strengths?.length > 0 && (
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Strengths</h4>
                                <ul className="space-y-1">
                                    {profile.strengths.map((s, i) => (
                                        <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                                            <span className="text-green-400 mt-0.5">✓</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {profile.weaknesses?.length > 0 && (
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Weaknesses</h4>
                                <ul className="space-y-1">
                                    {profile.weaknesses.map((s, i) => (
                                        <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5">✗</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {profile.opportunities?.length > 0 && (
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1">Opportunities</h4>
                                <ul className="space-y-1">
                                    {profile.opportunities.map((s, i) => (
                                        <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                                            <span className="text-yellow-400 mt-0.5">→</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {profile.suggestedServices?.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Suggested Services</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.suggestedServices.map((s, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setOpen(false)}
                            className="w-full mt-2 py-2 bg-[#252525] hover:bg-[#333] rounded-lg text-sm text-white font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
