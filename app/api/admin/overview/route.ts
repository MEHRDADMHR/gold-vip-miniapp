import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const headers = {
    apikey: auth.key,
    Authorization: `Bearer ${auth.key}`,
  };

  const resources = ["users", "videos", "plans", "subscriptions"] as const;
  const results = await Promise.all(resources.map(async (table) => {
    const response = await fetch(
      `${auth.url}/rest/v1/${table}?select=*&order=created_at.desc&limit=100`,
      { headers, cache: "no-store" },
    );
    if (!response.ok) {
      return { table, error: response.status };
    }
    return { table, rows: await response.json() as unknown[] };
  }));

  const failed = results.find((item) => "error" in item);
  if (failed) {
    return NextResponse.json({ error: `Could not load ${failed.table} (HTTP ${failed.error})` }, { status: 502 });
  }

  const data = Object.fromEntries(results.map((item) => [item.table, "rows" in item ? item.rows : []]));
  return NextResponse.json({ role: auth.role, data });
}
