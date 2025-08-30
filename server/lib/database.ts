import { MongoClient, Db, Collection } from "mongodb";
import { Farmer, Admin } from "@shared/auth";

class Database {
  private static instance: Database;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      const connectionString = process.env.MONGODB_URI;

      if (!connectionString) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      this.client = new MongoClient(connectionString);
      await this.client.connect();

      // Get database name from connection string or use default
      const dbName = process.env.DB_NAME || "carbonroots";
      this.db = this.client.db(dbName);

      console.log("✅ Connected to MongoDB successfully");

      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log("📤 Disconnected from MongoDB");
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  // Collection getters with proper typing
  getFarmersCollection(): Collection<import("./services").DatabaseFarmer> {
    return this.getDb().collection("farmers");
  }

  getAdminsCollection(): Collection<import("./services").DatabaseAdmin> {
    return this.getDb().collection("admins");
  }

  getOTPCollection(): Collection<{
    email: string;
    otp: string;
    expires: Date;
    type: "registration" | "login" | "password_reset";
  }> {
    return this.getDb().collection("otps");
  }

  getSessionsCollection(): Collection<{
    token: string;
    userId: string;
    userType: "farmer" | "admin";
    createdAt: Date;
    expiresAt: Date;
    isActive: boolean;
  }> {
    return this.getDb().collection("sessions");
  }

  getPasswordsCollection(): Collection<{
    userId: string;
    userType: "farmer" | "admin";
    hashedPassword: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return this.getDb().collection("passwords");
  }

  getIotReadingsCollection(): Collection<{
    farmerId?: string;
    sensorId: string;
    timestamp: Date;
    metrics: Record<string, number>;
    raw?: any;
    createdAt: Date;
  }> {
    return this.getDb().collection("iot_readings");
  }

  private async createIndexes(): Promise<void> {
    try {
      // Farmers collection indexes
      await this.getFarmersCollection().createIndex(
        { email: 1 },
        { unique: true },
      );
      await this.getFarmersCollection().createIndex({ phone: 1 });
      await this.getFarmersCollection().createIndex({ "location.pincode": 1 });

      // Admins collection indexes
      await this.getAdminsCollection().createIndex(
        { email: 1 },
        { unique: true },
      );

      // OTPs collection indexes
      await this.getOTPCollection().createIndex({ email: 1 });
      await this.getOTPCollection().createIndex(
        { expires: 1 },
        { expireAfterSeconds: 0 },
      );

      // Sessions collection indexes
      await this.getSessionsCollection().createIndex(
        { token: 1 },
        { unique: true },
      );
      await this.getSessionsCollection().createIndex({ userId: 1 });
      await this.getSessionsCollection().createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      );

      // Passwords collection indexes
      await this.getPasswordsCollection().createIndex(
        { userId: 1, userType: 1 },
        { unique: true },
      );

      // IoT readings indexes
      await this.getIotReadingsCollection().createIndex({ sensorId: 1 });
      await this.getIotReadingsCollection().createIndex({ farmerId: 1 });
      await this.getIotReadingsCollection().createIndex({ timestamp: -1 });

      console.log("📊 Database indexes created successfully");
    } catch (error) {
      console.error("❌ Failed to create database indexes:", error);
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.getDb().admin().ping();
      return true;
    } catch (error) {
      console.error("❌ Database health check failed:", error);
      return false;
    }
  }
}

export default Database;
