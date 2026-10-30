// Server-side proxy for the Business Defaulters API so the key never reaches the browser.
export async function GET(request: Request) {
  const gst = new URL(request.url).searchParams.get("gst")?.trim().toUpperCase();
  if (!gst) {
    return Response.json({ success: false, error: "gst is required" }, { status: 400 });
  }

  const apiKey = process.env.BD_API_KEY;
  // Accept either the base URL or the full /check-defaulter endpoint
  const baseUrl = process.env.BD_API_BASE_URL?.replace(/\/+$/, "").replace(/\/check-defaulter$/, "");
  if (!apiKey || !baseUrl) {
    return Response.json({ success: false, error: "Defaulter API is not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/check-defaulter?gst=${encodeURIComponent(gst)}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ success: false, error: "Could not reach defaulter API" }, { status: 502 });
  }
}
