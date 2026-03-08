// Cloudflare Worker — MVG Departures Proxy v2
// Supports two stops: default Kiefernstraße bus, and Fasangarten S-Bahn
// Query params:
//   stopName=Fasangarten    — looks up this stop instead of default
//   transportTypes=SBAHN    — filter transport types
//   limit=16                — max departures

const DEFAULT_STOP = "Kiefernstraße";
const MVG_BASE     = "https://www.mvg.de/api/bgw-pt/v3";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url            = new URL(request.url);
    const stopName       = url.searchParams.get("stopName") || DEFAULT_STOP;
    const limit          = url.searchParams.get("limit") || "16";
    const transportTypes = url.searchParams.get("transportTypes") || "BUS,TRAM,UBAHN,SBAHN,REGIONAL_BUS";
    let   stopId         = url.searchParams.get("stopId");

    try {
      // Step 1: resolve stop name → globalId
      if (!stopId) {
        const locResp = await fetch(
          `${MVG_BASE}/locations?query=${encodeURIComponent(stopName)}&locationTypes=STATION`,
          { headers: mvgHeaders() }
        );
        if (!locResp.ok) throw new Error(`Location lookup ${locResp.status}`);
        const locs = await locResp.json();

        const stations = (Array.isArray(locs) ? locs : [])
          .filter(l => l.type === "STATION" && l.globalId);

        // Prefer Munich city (de:09162), fall back to first result
        const chosen = stations.find(s => s.globalId.startsWith("de:09162")) || stations[0];
        if (!chosen) throw new Error(`Stop not found: "${stopName}". Got: ${JSON.stringify(locs).slice(0,300)}`);
        stopId = chosen.globalId;
      }

      // Step 2: fetch departures
      const depUrl = `${MVG_BASE}/departures?globalId=${stopId}&limit=${limit}&offsetInMinutes=0&transportTypes=${transportTypes}`;
      const depResp = await fetch(depUrl, { headers: mvgHeaders() });
      if (!depResp.ok) throw new Error(`Departures ${depResp.status}`);
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
