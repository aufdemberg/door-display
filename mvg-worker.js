// Cloudflare Worker — MVG Departures Proxy
// Deploy at: https://dash.cloudflare.com → Workers & Pages → Create Worker
// Paste this entire file, click Deploy.
// Your worker URL will look like: https://mvg-proxy.YOUR-NAME.workers.dev
// Update WORKER_URL in door-display.html with that URL.

const STOP_ID   = "de:09162:730";   // Kiefernstraße, Munich
const MVG_BASE  = "https://www.mvg.de/api/bgw-pt/v3/departures";

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const stopId = url.searchParams.get("stopId") || STOP_ID;
    const limit  = url.searchParams.get("limit")  || "16";

    const mvgUrl = `${MVG_BASE}?globalId=${stopId}&limit=${limit}&offsetInMinutes=0&transportTypes=BUS,TRAM,UBAHN,SBAHN`;

    try {
      const resp = await fetch(mvgUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; door-display/1.0)",
        },
      });

      const body = await resp.text();

      return new Response(body, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
