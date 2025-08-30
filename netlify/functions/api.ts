import type { Handler } from "@netlify/functions";
import sgMail from "@sendgrid/mail";
import { MongoClient, Db, Collection } from "mongodb";
import jwt from "jsonwebtoken";

// ========= Env & Setup =========
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "carbonroots";
const JWT_SECRET = process.env.JWT_SECRET || "";

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;

async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) throw new Error("MONGODB_URI not set");
  cachedClient = new MongoClient(MONGODB_URI);
  await cachedClient.connect();
  cachedDb = cachedClient.db(DB_NAME);
  // Ensure TTL index for OTPs
  await cachedDb.collection("otps").createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  return cachedDb;
}

// ========= Types =========
interface OTPDoc {
  email: string;
  otp: string;
  type: "registration" | "login" | "password_reset";
  createdAt: Date;
  expires: Date;
}

interface FarmerDoc {
  _id?: any;
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  farmName?: string;
  landSize?: number;
  landUnit?: "acres" | "hectares";
  farmingType?: "organic" | "conventional" | "mixed";
  primaryCrops?: string[];
  irrigationType?: "rain_fed" | "canal" | "borewell" | "drip" | "sprinkler";
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    pincode?: string;
    state?: string;
    district?: string;
  };
  interestedProjects?: string[];
  sustainablePractices?: string[];
  estimatedIncome?: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ========= Helpers =========
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.log(`⚠️ SendGrid not configured. OTP for ${email}: ${otp}`);
    return true; // allow fallback in case email provider missing
  }

  const subject = "Carbon Roots - OTP Verification";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#059669">Login Verification</h2>
      <p>नमस्ते! आपका OTP verification code:</p>
      <div style="padding:16px;border:2px solid #e2e8f0;border-radius:12px;text-align:center">
        <div style="color:#64748b;margin-bottom:8px">OTP Code</div>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#059669">${otp}</div>
        <div style="color:#ef4444;margin-top:8px">यह OTP 5 मिनट के लिए मान्य है</div>
      </div>
      <p style="color:#64748b;margin-top:16px">अगर आपने यह अनुरोध नहीं किया है, तो इस ईमेल को नजरअंदाज करें।</p>
    </div>
  `;

  await sgMail.send({
    to: email,
    from: { email: SENDGRID_FROM_EMAIL, name: "Carbon Roots" },
    subject,
    html,
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });
  return true;
}

function signToken(payload: Record<string, any>): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function parseToken(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function cors(event: any) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  } as const;
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  return headers;
}

// ========= Handler =========
export const handler: Handler = async (event) => {
  const preflight = cors(event);
  if (typeof preflight !== "object" || (preflight as any).statusCode === 200) {
    if ((preflight as any).statusCode) return preflight as any;
  }
  const headers = preflight as Record<string, string>;

  try {
    const path = event.path.replace("/.netlify/functions/api", "");
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    // Health & Ping
    if (path === "/api/health" && method === "GET") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "ok",
          emailConfigured: !!SENDGRID_API_KEY,
          dbConfigured: !!MONGODB_URI,
          timestamp: new Date().toISOString(),
        }),
      };
    }
    if (path === "/api/ping" && method === "GET") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: process.env.PING_MESSAGE ?? "pong" }),
      };
    }

    // Send OTP
    if (path === "/api/auth/send-otp" && method === "POST") {
      const { email } = body as { email?: string };
      if (!email || !isValidEmail(email)) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Valid email is required" }) };
      }

      const db = await getDb();
      const otps = db.collection<OTPDoc>("otps");
      const otp = generateOTP();
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      await otps.updateOne(
        { email, type: "login" },
        { $set: { email, otp, type: "login", createdAt: new Date(), expires } },
        { upsert: true },
      );

      const sent = await sendOTPEmail(email, otp);
      if (!sent) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "Failed to send OTP" }) };
      }

      const response: any = { success: true, message: "OTP sent successfully" };
      if (process.env.NODE_ENV === "development" && process.env.DEBUG_AUTH === "true") {
        response.otp = otp;
      }
      return { statusCode: 200, headers, body: JSON.stringify(response) };
    }

    // Verify OTP and login/create farmer
    if (path === "/api/auth/verify-otp" && method === "POST") {
      const { email, otp, registrationData } = body as { email?: string; otp?: string; registrationData?: Partial<FarmerDoc> };
      if (!email || !otp) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Email and OTP are required" }) };
      }

      const db = await getDb();
      const otps = db.collection<OTPDoc>("otps");
      const farmers = db.collection<FarmerDoc>("farmers");

      const record = await otps.findOne({ email, type: "login" });
      if (!record) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "OTP not found or expired" }) };
      }
      if (record.expires.getTime() < Date.now()) {
        await otps.deleteOne({ email, type: "login" });
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "OTP has expired" }) };
      }
      if (record.otp !== otp) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Invalid OTP" }) };
      }

      await otps.deleteOne({ email, type: "login" });

      // Find or create farmer
      const now = new Date();
      const existing = await farmers.findOne({ email });
      let farmer: FarmerDoc;
      if (existing) {
        farmer = existing;
      } else {
        farmer = {
          email,
          name: registrationData?.name || email.split("@")[0],
          phone: registrationData?.phone || "",
          farmName: registrationData?.farmName || "",
          landSize: registrationData?.landSize || 0,
          landUnit: registrationData?.landUnit || "acres",
          farmingType: registrationData?.farmingType || "conventional",
          primaryCrops: registrationData?.primaryCrops || [],
          irrigationType: registrationData?.irrigationType || "rain_fed",
          location: registrationData?.location || { address: "", pincode: "", state: "" },
          interestedProjects: registrationData?.interestedProjects || [],
          sustainablePractices: registrationData?.sustainablePractices || [],
          estimatedIncome: 0,
          verified: false,
          createdAt: now,
          updatedAt: now,
        };
        const result = await farmers.insertOne(farmer);
        farmer._id = result.insertedId;
      }

      const user = {
        type: "farmer" as const,
        farmer: {
          id: (farmer._id || farmer.id || "").toString(),
          email: farmer.email,
          name: farmer.name,
          phone: farmer.phone,
          farmName: farmer.farmName,
          landSize: farmer.landSize,
          landUnit: farmer.landUnit,
          farmingType: farmer.farmingType,
          primaryCrops: farmer.primaryCrops,
          irrigationType: farmer.irrigationType,
          location: farmer.location as any,
          interestedProjects: farmer.interestedProjects,
          sustainablePractices: farmer.sustainablePractices,
          estimatedIncome: farmer.estimatedIncome,
          verified: !!farmer.verified,
          createdAt: farmer.createdAt,
          updatedAt: farmer.updatedAt,
        },
      };

      const token = signToken({ type: "farmer", userId: user.farmer.id, email: user.farmer.email });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user, token }) };
    }

    // Admin login (env based)
    if (path === "/api/auth/admin-login" && method === "POST") {
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Email and password are required" }) };
      }
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "Admin auth not configured" }) };
      }
      if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "Invalid credentials" }) };
      }

      const admin = {
        id: `admin:${email}`,
        email,
        name: "System Admin",
        role: "admin" as const,
        createdAt: new Date(),
      };
      const user = { type: "admin" as const, admin };
      const token = signToken({ type: "admin", userId: admin.id, email: admin.email });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user, token }) };
    }

    // Verify token
    if (path === "/api/auth/verify" && method === "GET") {
      const auth = event.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const payload = token ? parseToken(token) : null;
      if (!payload) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "Invalid or missing token" }) };
      }

      if (payload.type === "admin") {
        const user = { type: "admin" as const, admin: { id: payload.userId, email: payload.email, name: "System Admin", role: "admin", createdAt: new Date() } };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
      }

      // For farmer, fetch latest profile
      const db = await getDb();
      const farmers = db.collection<FarmerDoc>("farmers");
      const farmer = await farmers.findOne({ email: payload.email });
      if (!farmer) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "User not found" }) };
      }
      const user = {
        type: "farmer" as const,
        farmer: {
          id: (farmer._id || farmer.id || "").toString(),
          email: farmer.email,
          name: farmer.name,
          phone: farmer.phone,
          farmName: farmer.farmName,
          landSize: farmer.landSize,
          landUnit: farmer.landUnit,
          farmingType: farmer.farmingType,
          primaryCrops: farmer.primaryCrops,
          irrigationType: farmer.irrigationType,
          location: farmer.location as any,
          interestedProjects: farmer.interestedProjects,
          sustainablePractices: farmer.sustainablePractices,
          estimatedIncome: farmer.estimatedIncome,
          verified: !!farmer.verified,
          createdAt: farmer.createdAt,
          updatedAt: farmer.updatedAt,
        },
      };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
    }

    // Update farmer profile
    if (path === "/api/auth/update-profile" && method === "PUT") {
      const auth = event.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const payload = token ? parseToken(token) : null;
      if (!payload || payload.type !== "farmer") {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "Invalid token or user type" }) };
      }

      const updates = body || {};
      const db = await getDb();
      const farmers = db.collection<FarmerDoc>("farmers");
      const result = await farmers.findOneAndUpdate(
        { email: payload.email },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      const farmer = result.value;
      if (!farmer) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, message: "Farmer not found" }) };
      }

      const user = {
        type: "farmer" as const,
        farmer: {
          id: (farmer._id || farmer.id || "").toString(),
          email: farmer.email,
          name: farmer.name,
          phone: farmer.phone,
          farmName: farmer.farmName,
          landSize: farmer.landSize,
          landUnit: farmer.landUnit,
          farmingType: farmer.farmingType,
          primaryCrops: farmer.primaryCrops,
          irrigationType: farmer.irrigationType,
          location: farmer.location as any,
          interestedProjects: farmer.interestedProjects,
          sustainablePractices: farmer.sustainablePractices,
          estimatedIncome: farmer.estimatedIncome,
          verified: !!farmer.verified,
          createdAt: farmer.createdAt,
          updatedAt: farmer.updatedAt,
        },
      };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
    }

    // Logout (no-op for JWT)
    if (path === "/api/auth/logout" && method === "POST") {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Logged out" }) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, message: `API endpoint not found: ${method} ${path}` }),
    };
  } catch (error: any) {
    console.error("🚨 [NETLIFY ERROR]", error);
    return {
      statusCode: 500,
      headers: typeof preflight === "object" ? (preflight as any).headers || preflight : {},
      body: JSON.stringify({ success: false, message: "Internal server error", error: process.env.NODE_ENV !== "production" ? error?.message : undefined }),
    };
  }
};
