import { RequestHandler } from "express";

// This endpoint validates inputs and checks for provider configuration.
// If a provider is configured via env, you can extend this to call real APIs.
export const getNDVI: RequestHandler = async (req, res) => {
  try {
    const { lat, lon, startDate, endDate } = req.body || {};

    const latitude = typeof lat === "string" ? parseFloat(lat) : lat;
    const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return res.status(400).json({ success: false, message: "Valid lat and lon are required" });
    }

    // Provider check
    const provider = process.env.SATELLITE_PROVIDER;
    if (!provider) {
      return res.status(501).json({
        success: false,
        message:
          "Satellite provider not configured. Please set SATELLITE_PROVIDER and credentials to enable real NDVI integration.",
      });
    }

    // Placeholder logic to show response shape when provider is set
    const now = new Date();
    const coverage = {
      provider,
      location: { lat: latitude, lon: longitude },
      timeWindow: { start: startDate || null, end: endDate || null },
      ndviSummary: {
        mean: 0,
        min: 0,
        max: 0,
        count: 0,
      },
      tiles: [],
      generatedAt: now.toISOString(),
    };

    res.json({ success: true, data: coverage });
  } catch (error) {
    console.error("❌ [SATELLITE NDVI] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
