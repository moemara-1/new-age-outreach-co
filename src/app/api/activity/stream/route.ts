import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const POLL_INTERVAL = 2000;

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let lastId = "";
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const poll = async () => {
        if (closed) return;

        try {
          const where = lastId ? { id: { gt: lastId } } : {};
          const entries = await db.activityLog.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: lastId ? 20 : 50,
          });

          if (entries.length > 0) {
            lastId = entries[entries.length - 1].id;
            for (const entry of entries) {
              sendEvent(JSON.stringify({
                id: entry.id,
                agent: entry.agent.toLowerCase(),
                time: entry.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }),
                title: entry.title,
                subtitle: entry.subtitle ?? undefined,
              }));
            }
          }
        } catch {
          // DB error — skip this poll cycle
        }

        if (!closed) {
          setTimeout(poll, POLL_INTERVAL);
        }
      };

      await poll();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
