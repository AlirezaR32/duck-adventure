import { NextResponse } from "next/server";

// force-static keeps this handler exportable for the static APK shell
// (behavior for the web deployment is unchanged).
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}