import { NextResponse } from "next/server";
import { createLeadPayment } from "@/services/payment.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: leadId } = await params;
  const body = await request.json();

  const amountCents = body.amountCents ?? 49900;
  const currency = body.currency ?? "usd";

  try {
    const result = await createLeadPayment({ leadId, amountCents, currency });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
