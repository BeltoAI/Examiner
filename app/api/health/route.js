export const dynamic = "force-dynamic";
export async function GET() {
  const base = process.env.LLM_URL || "http://minibelto.duckdns.org:8007";
  try {
    const r = await fetch(`${base}/v1/models`, { cache: "no-store" });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
