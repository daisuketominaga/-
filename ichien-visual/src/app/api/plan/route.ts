import { NextRequest, NextResponse } from "next/server";
import { generatePlan, type PlanRequest } from "@/lib/planGen";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as PlanRequest;
  try {
    return NextResponse.json(await generatePlan(body));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
