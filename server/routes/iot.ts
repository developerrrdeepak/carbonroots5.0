import { RequestHandler } from "express";
import Database from "../lib/database";
import AuthService from "../lib/services";

const db = Database.getInstance();
const auth = new AuthService();

export const ingestSensorData: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }
    const user = await auth.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const { sensorId, farmerId, timestamp, metrics, raw } = req.body || {};
    if (!sensorId || !metrics || typeof metrics !== "object") {
      return res
        .status(400)
        .json({ success: false, message: "sensorId and metrics are required" });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();
    const doc = {
      sensorId: String(sensorId),
      farmerId: farmerId
        ? String(farmerId)
        : user.type === "farmer"
          ? user.farmer!.id
          : undefined,
      timestamp: ts,
      metrics: Object.fromEntries(
        Object.entries(metrics).filter(([_, v]) => typeof v === "number"),
      ) as Record<string, number>,
      raw,
      createdAt: new Date(),
    };

    const col = db.getIotReadingsCollection();
    await col.insertOne(doc as any);

    return res.json({
      success: true,
      stored: {
        sensorId: doc.sensorId,
        farmerId: doc.farmerId,
        timestamp: doc.timestamp,
      },
    });
  } catch (error) {
    console.error("❌ [IOT INGEST] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getLatestSensorData: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }
    const user = await auth.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const farmerIdQuery =
      (req.query.farmerId as string) ||
      (user.type === "farmer" ? user.farmer!.id : undefined);
    const sensorId = req.query.sensorId as string | undefined;

    const col = db.getIotReadingsCollection();
    const filter: any = {};
    if (farmerIdQuery) filter.farmerId = farmerIdQuery;
    if (sensorId) filter.sensorId = sensorId;

    const readings = await col
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    res.json({ success: true, readings });
  } catch (error) {
    console.error("❌ [IOT LATEST] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
