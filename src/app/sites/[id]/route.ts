import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const site = await db.demoSite.findUnique({
        where: { leadId: id }
    });

    if (!site || !site.htmlContent) {
        return new NextResponse("Site not found or hasn't finished building yet.", { status: 404 });
    }

    return new NextResponse(site.htmlContent, {
        headers: { "Content-Type": "text/html" }
    });
}
