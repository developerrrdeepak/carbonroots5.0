import { RequestHandler } from "express";
import Database from "../lib/database";
import AuthService from "../lib/services";
import { defaultPublicStats, PublicStats } from "../../shared/site";

const db = Database.getInstance();
const auth = new AuthService();

export const getPublicStats: RequestHandler = async (_req, res) => {
  try {
    const col = db.getSettingsCollection();
    const doc = await col.findOne({ key: "publicStats" });
    const value: PublicStats = doc?.value || defaultPublicStats;
    res.json({ success: true, stats: value });
  } catch (e) {
    console.error("[getPublicStats]", e);
    res.status(500).json({ success: false, message: "Failed to load stats" });
  }
};

export const updatePublicStats: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token)
      return res.status(401).json({ success: false, message: "No token" });
    const user = await auth.getUserByToken(token);
    if (!user || user.type !== "admin")
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });

    const incoming = req.body as Partial<PublicStats>;
    const next: PublicStats = {
      ...defaultPublicStats,
      ...incoming,
      activeSensors: Math.max(
        0,
        Number(incoming.activeSensors ?? defaultPublicStats.activeSensors),
      ),
      totalFarmers: Math.max(
        0,
        Number(incoming.totalFarmers ?? defaultPublicStats.totalFarmers),
      ),
      totalIncomeINR: Math.max(
        0,
        Number(incoming.totalIncomeINR ?? defaultPublicStats.totalIncomeINR),
      ),
      languagesSupported: Math.max(
        1,
        Number(
          incoming.languagesSupported ?? defaultPublicStats.languagesSupported,
        ),
      ),
      supportLabel: String(
        incoming.supportLabel ?? defaultPublicStats.supportLabel,
      ),
      updatedAt: new Date().toISOString(),
    };

    const col = db.getSettingsCollection();
    await col.updateOne(
      { key: "publicStats" },
      { $set: { key: "publicStats", value: next, updatedAt: new Date() } },
      { upsert: true },
    );
    res.json({ success: true, stats: next });
  } catch (e) {
    console.error("[updatePublicStats]", e);
    res.status(500).json({ success: false, message: "Failed to update stats" });
  }
};
