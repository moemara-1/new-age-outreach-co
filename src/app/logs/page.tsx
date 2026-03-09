export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";

const STATUS_COLORS: Record<string, string> = {
    QUEUED: "bg-gray-500",
    RUNNING: "bg-blue-500",
    COMPLETED: "bg-green-500",
    FAILED: "bg-red-500",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
    QUEUED: "text-gray-400",
    RUNNING: "text-blue-400",
    COMPLETED: "text-green-400",
    FAILED: "text-red-400",
};

export default async function LogsPage() {
    const runs = await db.agentRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { campaign: true },
    });

    return (
        <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Agent Logs</h1>
                    <Link href="/" className="text-sm text-[#666] hover:text-white">
                        &larr; Dashboard
                    </Link>
                </div>

                <div className="bg-[#111] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#222] text-[#999] text-left">
                                <th className="px-4 py-3 font-medium">Agent</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Campaign</th>
                                <th className="px-4 py-3 font-medium">Started</th>
                                <th className="px-4 py-3 font-medium">Duration</th>
                                <th className="px-4 py-3 font-medium w-[40%]">Details / Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => {
                                const duration =
                                    run.startedAt && run.finishedAt
                                        ? `${((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000).toFixed(1)}s`
                                        : "—";

                                const errorSummary = run.error
                                    ? extractError(run.error)
                                    : run.output
                                        ? JSON.stringify(run.output).substring(0, 120)
                                        : "—";

                                return (
                                    <tr key={run.id} className="border-b border-[#1A1A1A] hover:bg-[#161616]">
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-white">{run.agent}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[run.status] ?? "bg-gray-500"}`} />
                                                <span className={`font-medium ${STATUS_TEXT_COLORS[run.status] ?? "text-[#ccc]"}`}>
                                                    {run.status}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[#999]">
                                            {run.campaign?.name ?? "—"}
                                        </td>
                                        <td className="px-4 py-3 text-[#999] font-mono text-xs">
                                            {run.startedAt
                                                ? run.startedAt.toLocaleTimeString("en-US", {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                    hour12: true,
                                                })
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-[#ccc] font-mono text-xs">
                                            {duration}
                                        </td>
                                        <td className="px-4 py-3">
                                            {run.error ? (
                                                <span className="text-red-400 text-xs font-mono break-words leading-relaxed">
                                                    {errorSummary}
                                                </span>
                                            ) : (
                                                <span className="text-[#666] text-xs font-mono">
                                                    {errorSummary}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {runs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-[#555]">
                                        No agent runs yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function extractError(raw: string): string {
    const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (match) return match[1].substring(0, 200);
    return raw.substring(0, 200);
}
