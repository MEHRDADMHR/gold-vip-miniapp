import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server configuration is incomplete" }, { status: 503 });
  }

  const response = await fetch(
    `${url}/rest/v1/plans?select=id,title,duration_days,price_minor,currency&is_active=eq.true&order=duration_days.asc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json({ error: "بارگذاری پلن‌ها ناموفق بود." }, { status: 502 });
  }

  const rows = await response.json();
  return NextResponse.json({ plans: Array.isArray(rows) ? rows : [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
