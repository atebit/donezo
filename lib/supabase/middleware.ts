// TODO epic 03: implement session refresh per @supabase/ssr middleware recipe.
import { type NextRequest, NextResponse } from "next/server";

export function updateSession(_request: NextRequest): NextResponse {
  return NextResponse.next();
}
