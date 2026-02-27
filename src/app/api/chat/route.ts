import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { message } = await request.json();
  // TODO: Route to appropriate agent based on intent
  return NextResponse.json({
    reply: `Received: "${message}". Agent routing not yet implemented.`,
  });
}
