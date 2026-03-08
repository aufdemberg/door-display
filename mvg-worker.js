// Cloudflare Worker — MVG Departures Proxy
// Looks up "Kiefernstraße" by name first, picks the stop serving lines 145/220,
// then fetches live departures. No hardcoded stop ID needed.

const STOP_NAME = "Kiefernstraße";
const MVG_BASE  = "https://www.mvg.de/api/bgw-pt/v3";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url   = new URL(request.url);
    const limit = url.searchParams.get("limit") || "16";

    // Optional: accept a specific stopId to skip the lookup
    let stopId = url.searchParams.get("stopId");

    try {
      // Step 1: find the stop by name if no ID given
      if (!stopId) {
        const locResp = await fetch(
          `${MVG_BASE}/locations?query=${encodeURIComponent(STOP_NAME)}&locationTypes=STATION`,
          { headers: mvgHeaders() }
        );
        if (!locResp.ok) throw new Error(`Location lookup failed: ${locResp.status}`);
        const locations = await locResp.json();

        // Filter to stations only, prefer the one in Munich city (09162)
        const stations = (Array.isArray(locations) ? locations : [])
          .filter(l => l.type === "STATION" && l.globalId);

        // Pick Munich city stop (globalId starts with de:09162) — first match
        const munich = stations.find(s => s.globalId.startsWith("de:09162"));
        const chosen = munich || stations[0];

        if (!chosen) throw new Error(`No station found for "${STOP_NAME}". Locations: ${JSON.stringify(locations).slice(0,300)}`);
        stopId = chosen.globalId;
      }

      // Step 2: fetch departures
      const depResp = await fetch(
        `${MVG_BASE}/departures?globalId=${stopId}&limit=${limit}&offsetInMinutes=0&transportTypes=BUS,TRAM,UBAHN,SBAHN,REGIONAL_BUS`,
        { headers: mvgHeaders() }
      );
      if (!depResp.ok) throw new Error(`Departures failed: ${depResp.status}`);
      const body = await depResp.text();

      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
  },
};

function mvgHeaders() {
  return {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; door-display/1.0)",
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
