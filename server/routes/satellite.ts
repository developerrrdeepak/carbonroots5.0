import { RequestHandler } from "express";

const SH_TOKEN_URL = "https://services.sentinel-hub.com/oauth/token";
const SH_STATS_URL = "https://services.sentinel-hub.com/api/v1/statistics";

async function getSentinelToken(clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const resp = await fetch(SH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error(`Sentinel auth failed: ${resp.status}`);
  const data = (await resp.json()) as {
    access_token: string;
    expires_in: number;
  };
  return data.access_token;
}

function pointBBox(lat: number, lon: number, deltaDeg = 0.001) {
  // ~100m buffer
  return [lon - deltaDeg, lat - deltaDeg, lon + deltaDeg, lat + deltaDeg];
}

export const getNDVI: RequestHandler = async (req, res) => {
  try {
    const { lat, lon, from, to } = req.body || {};

    const latitude = typeof lat === "string" ? parseFloat(lat) : lat;
    const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Valid lat and lon are required" });
    }

    const provider = process.env.SATELLITE_PROVIDER;
    if (provider !== "sentinelhub") {
      return res
        .status(501)
        .json({
          success: false,
          message: "Set SATELLITE_PROVIDER=sentinelhub to enable this endpoint",
        });
    }

    const clientId = process.env.SH_CLIENT_ID;
    const clientSecret = process.env.SH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res
        .status(501)
        .json({
          success: false,
          message: "Missing SH_CLIENT_ID/SH_CLIENT_SECRET env vars",
        });
    }

    const token = await getSentinelToken(clientId, clientSecret);

    const now = new Date();
    const end = to ? new Date(to) : now;
    const start = from
      ? new Date(from)
      : new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const bbox = pointBBox(latitude, longitude);

    const body = {
      input: {
        bounds: { bbox },
        data: [
          {
            type: "S2L2A",
            dataFilter: {
              maxCloudCoverage: 60,
            },
          },
        ],
      },
      aggregation: {
        timeRange: { from: start.toISOString(), to: end.toISOString() },
        aggregationInterval: { of: "P30D" },
        resx: 10,
        resy: 10,
      },
      calculations: {
        default: {
          bands: {
            B04: { statistics: { default: {} } },
            B08: { statistics: { default: {} } },
          },
        },
      },
    } as any;

    const resp = await fetch(SH_STATS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Sentinel stats failed: ${resp.status} ${t}`);
    }

    const stats = (await resp.json()) as any;
    // Extract mean B04 and B08 from the first interval if available
    const intervals =
      stats.data?.[0]?.dimensions?.time ||
      stats.data?.[0]?.intervals ||
      stats.data ||
      [];
    const first = Array.isArray(intervals) ? intervals[0] : null;
    const b04Mean = first?.outputs?.default?.bands?.B04?.stats?.mean ?? null;
    const b08Mean = first?.outputs?.default?.bands?.B08?.stats?.mean ?? null;

    let ndvi: number | null = null;
    if (
      typeof b04Mean === "number" &&
      typeof b08Mean === "number" &&
      b08Mean + b04Mean !== 0
    ) {
      ndvi = (b08Mean - b04Mean) / (b08Mean + b04Mean);
    }

    res.json({
      success: true,
      provider: "sentinelhub",
      location: { lat: latitude, lon: longitude },
      timeWindow: { from: start.toISOString(), to: end.toISOString() },
      ndvi,
      redMean: b04Mean,
      nirMean: b08Mean,
      raw: stats,
    });
  } catch (error: any) {
    console.error("❌ [SATELLITE NDVI] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error?.message || "Internal server error",
      });
  }
};
