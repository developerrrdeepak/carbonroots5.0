import { ObjectId, OptionalId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Database from "./database";
import {
  Farmer,
  Admin,
  AuthUser,
  EnhancedFarmerRegistration,
} from "@shared/auth";

export interface DatabaseFarmer extends Omit<Farmer, "id"> {
  _id?: ObjectId;
}

export interface DatabaseAdmin extends Omit<Admin, "id"> {
  _id?: ObjectId;
}

export interface OTPRecord {
  _id?: ObjectId;
  email: string;
  otp: string;
  expires: Date;
  type: "registration" | "login" | "password_reset";
  createdAt: Date;
}

export interface PasswordRecord {
  _id?: ObjectId;
  userId: string;
  userType: "farmer" | "admin";
  hashedPassword: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  _id?: ObjectId;
  token: string;
  userId: string;
  userType: "farmer" | "admin";
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

class AuthService {
  private db: Database;
  private saltRounds = 12;

  constructor() {
    this.db = Database.getInstance();
  }

  // Generate OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate JWT token
  generateJWTToken(userId: string, userType: "farmer" | "admin"): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not set");
    }

    return jwt.sign(
      {
        userId,
        userType,
        iat: Date.now() / 1000,
      },
      secret,
      { expiresIn: "7d" }, // Token expires in 7 days
    );
  }

  // Verify JWT token
  verifyJWTToken(
    token: string,
  ): { userId: string; userType: "farmer" | "admin" } | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET environment variable is not set");
      }

      const decoded = jwt.verify(token, secret) as any;
      return { userId: decoded.userId, userType: decoded.userType };
    } catch (error) {
      return null;
    }
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  // Verify password
  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // OTP Operations
  async storeOTP(
    email: string,
    otp: string,
    type: "registration" | "login" | "password_reset",
  ): Promise<void> {
    const otpCollection = this.db.getOTPCollection();

    // Remove any existing OTPs for this email
    await otpCollection.deleteMany({ email });

    const otpRecord: OTPRecord = {
      email,
      otp,
      expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      type,
      createdAt: new Date(),
    };

    await otpCollection.insertOne(otpRecord);
  }

  async verifyOTP(email: string, otp: string): Promise<boolean> {
    const otpCollection = this.db.getOTPCollection();

    const otpRecord = await otpCollection.findOne({
      email,
      otp,
      expires: { $gt: new Date() },
    });

    if (otpRecord) {
      // Clean up used OTP
      await otpCollection.deleteOne({ _id: otpRecord._id });
      return true;
    }

    return false;
  }

  // Farmer Operations
  async createFarmer(
    email: string,
    registrationData?: EnhancedFarmerRegistration,
  ): Promise<Farmer> {
    const farmersCollection = this.db.getFarmersCollection();

    // Calculate estimated income
    let estimatedIncome = 0;
    if (registrationData) {
      const landSizeInHectares =
        registrationData.landUnit === "acres"
          ? registrationData.landSize * 0.405
          : registrationData.landSize;
      const baseIncome = landSizeInHectares * 1000;
      const practiceMultiplier =
        1 + registrationData.sustainablePractices.length * 0.1;
      estimatedIncome = Math.round(baseIncome * practiceMultiplier);
    }

    const farmerData: DatabaseFarmer = {
      email,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedIncome,
      ...(registrationData && {
        name: registrationData.name,
        phone: registrationData.phone,
        farmName: registrationData.farmName,
        landSize: registrationData.landSize,
        landUnit: registrationData.landUnit,
        farmingType: registrationData.farmingType,
        primaryCrops: registrationData.primaryCrops,
        irrigationType: registrationData.irrigationType,
        location: {
          address: registrationData.address,
          pincode: registrationData.pincode,
          state: registrationData.state,
          district: registrationData.district,
          latitude: registrationData.latitude,
          longitude: registrationData.longitude,
        },
        aadhaarId: registrationData.aadhaarNumber,
        panNumber: registrationData.panNumber,
        bankAccountNumber: registrationData.bankAccountNumber,
        ifscCode: registrationData.ifscCode,
        interestedProjects: registrationData.interestedProjects,
        sustainablePractices: registrationData.sustainablePractices,
      }),
    };

    const result = await farmersCollection.insertOne(farmerData);

    return {
      id: result.insertedId.toString(),
      ...farmerData,
    };
  }

  async findFarmerByEmail(email: string): Promise<Farmer | null> {
    const farmersCollection = this.db.getFarmersCollection();
    const farmer = await farmersCollection.findOne({ email });

    if (!farmer) return null;

    return {
      id: farmer._id?.toString() || "",
      ...farmer,
    };
  }

  async findFarmerById(id: string): Promise<Farmer | null> {
    const farmersCollection = this.db.getFarmersCollection();
    const farmer = await farmersCollection.findOne({ _id: new ObjectId(id) });

    if (!farmer) return null;

    return {
      id: farmer._id?.toString() || "",
      ...farmer,
    };
  }

  async updateFarmer(
    id: string,
    updates: Partial<Farmer>,
  ): Promise<Farmer | null> {
    const farmersCollection = this.db.getFarmersCollection();

    // Recalculate estimated income if relevant fields are updated
    if (updates.landSize || updates.landUnit || updates.sustainablePractices) {
      const farmer = await this.findFarmerById(id);
      if (farmer) {
        const landSize = updates.landSize || farmer.landSize || 0;
        const landUnit = updates.landUnit || farmer.landUnit || "acres";
        const practices =
          updates.sustainablePractices || farmer.sustainablePractices || [];

        const landSizeInHectares =
          landUnit === "acres" ? landSize * 0.405 : landSize;
        const baseIncome = landSizeInHectares * 1000;
        const practiceMultiplier = 1 + practices.length * 0.1;
        updates.estimatedIncome = Math.round(baseIncome * practiceMultiplier);
      }
    }

    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    delete (updateData as any).id; // Remove id from updates

    const result = await farmersCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!result) return null;

    return {
      id: result._id?.toString() || "",
      ...result,
    };
  }

  async getAllFarmers(): Promise<Farmer[]> {
    const farmersCollection = this.db.getFarmersCollection();
    const farmers = await farmersCollection.find({}).toArray();

    return farmers.map((farmer) => ({
      id: farmer._id?.toString() || "",
      ...farmer,
    }));
  }

  // Admin Operations
  async findAdminByEmail(email: string): Promise<Admin | null> {
    const adminsCollection = this.db.getAdminsCollection();
    const admin = await adminsCollection.findOne({ email });

    if (!admin) return null;

    return {
      id: admin._id?.toString() || "",
      ...admin,
    };
  }

  async createDefaultAdmin(
    email: string,
    name: string = "Admin",
  ): Promise<Admin> {
    const adminsCollection = this.db.getAdminsCollection();

    const adminData: DatabaseAdmin = {
      email,
      name,
      role: "admin",
      createdAt: new Date(),
    };

    const result = await adminsCollection.insertOne(adminData);

    return {
      id: result.insertedId.toString(),
      ...adminData,
    };
  }

  // Password Operations
  async storePassword(
    userId: string,
    userType: "farmer" | "admin",
    password: string,
  ): Promise<void> {
    const passwordsCollection = this.db.getPasswordsCollection();
    const hashedPassword = await this.hashPassword(password);

    const passwordRecord: PasswordRecord = {
      userId,
      userType,
      hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await passwordsCollection.replaceOne({ userId, userType }, passwordRecord, {
      upsert: true,
    });
  }

  async verifyUserPassword(
    userId: string,
    userType: "farmer" | "admin",
    password: string,
  ): Promise<boolean> {
    const passwordsCollection = this.db.getPasswordsCollection();
    const passwordRecord = await passwordsCollection.findOne({
      userId,
      userType,
    });

    if (!passwordRecord) return false;

    return await this.verifyPassword(password, passwordRecord.hashedPassword);
  }

  // Session Operations (optional - since we're using JWT, but keeping for compatibility)
  async createSession(
    token: string,
    userId: string,
    userType: "farmer" | "admin",
  ): Promise<void> {
    const sessionsCollection = this.db.getSessionsCollection();

    const sessionRecord: SessionRecord = {
      token,
      userId,
      userType,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
    };

    await sessionsCollection.insertOne(sessionRecord);
  }

  async findSession(token: string): Promise<AuthUser | null> {
    const sessionsCollection = this.db.getSessionsCollection();
    const session = await sessionsCollection.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) return null;

    if (session.userType === "farmer") {
      const farmer = await this.findFarmerById(session.userId);
      return farmer ? { type: "farmer", farmer } : null;
    } else {
      const adminsCollection = this.db.getAdminsCollection();
      const admin = await adminsCollection.findOne({
        _id: new ObjectId(session.userId),
      });
      if (!admin) return null;

      return {
        type: "admin",
        admin: {
          id: admin._id?.toString() || "",
          ...admin,
        },
      };
    }
  }

  async invalidateSession(token: string): Promise<void> {
    const sessionsCollection = this.db.getSessionsCollection();
    await sessionsCollection.updateOne(
      { token },
      { $set: { isActive: false } },
    );
  }

  // Get user by JWT token
  async getUserByToken(token: string): Promise<AuthUser | null> {
    const decoded = this.verifyJWTToken(token);
    if (!decoded) return null;

    if (decoded.userType === "farmer") {
      const farmer = await this.findFarmerById(decoded.userId);
      return farmer ? { type: "farmer", farmer } : null;
    } else {
      const adminsCollection = this.db.getAdminsCollection();
      const admin = await adminsCollection.findOne({
        _id: new ObjectId(decoded.userId),
      });
      if (!admin) return null;

      return {
        type: "admin",
        admin: {
          id: admin._id?.toString() || "",
          ...admin,
        },
      };
    }
  }
}

export default AuthService;
