import { RequestHandler } from "express";
import {
  AuthUser,
  Farmer,
  Admin,
  LoginResponse,
  EnhancedFarmerRegistration,
  FarmerPasswordRequest,
  FarmerLoginRequest,
} from "@shared/auth";
import Database from "../lib/database";
import AuthService from "../lib/services";
import EmailService from "../lib/emailService";

// Initialize services
const db = Database.getInstance();
const authService = new AuthService();
const emailService = EmailService.getInstance();

// Email service wrapper functions
async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  return await emailService.sendOTPEmail(email, otp);
}

async function sendWelcomeEmail(
  email: string,
  farmerName: string,
  estimatedIncome: number,
): Promise<boolean> {
  return await emailService.sendWelcomeEmail(
    email,
    farmerName,
    estimatedIncome,
  );
}

// Initialize database connection
export async function initializeDatabase() {
  try {
    await db.connect();

    // Create default admin if not exists
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const existingAdmin = await authService.findAdminByEmail(adminEmail);
      if (!existingAdmin) {
        const admin = await authService.createDefaultAdmin(
          adminEmail,
          "System Admin",
        );

        // Set admin password if provided
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminPassword) {
          await authService.storePassword(admin.id, "admin", adminPassword);
          console.log(
            `✅ [ADMIN CREATED] Default admin created: ${adminEmail}`,
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ [DATABASE INIT] Failed to initialize database:", error);
    throw error;
  }
}

// Note: Database initialization is now handled by server startup, not module load

export const sendOTP: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`🔐 [SEND OTP] Request for email: ${email}`);

    if (!email) {
      console.log("❌ [SEND OTP] Email is missing");
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const otp = authService.generateOTP();

    // Store OTP in database
    await authService.storeOTP(email, otp, "login");

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);

    if (emailSent) {
      console.log(`✅ [SEND OTP] OTP sent successfully to ${email}`);

      const response: any = {
        success: true,
        message: "OTP sent successfully",
      };

      // Only include OTP in response for strict local development
      if (
        process.env.NODE_ENV === "development" &&
        process.env.DEBUG_AUTH === "true"
      ) {
        response.otp = otp;
      }

      res.json(response);
    } else {
      console.log(`❌ [SEND OTP] Failed to send email to ${email}`);
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  } catch (error) {
    console.error("❌ [SEND OTP] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyOTP: RequestHandler = async (req, res) => {
  try {
    const { email, otp, registrationData } = req.body;

    console.log(`🔐 [OTP VERIFICATION] Request for email: ${email}`);

    if (!email || !otp) {
      console.log("❌ [OTP VERIFICATION] Missing email or OTP");
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    // Verify OTP
    const isValidOTP = await authService.verifyOTP(email, otp);

    if (!isValidOTP) {
      console.log(`❌ [OTP VERIFICATION] Invalid or expired OTP for ${email}`);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Find or create farmer
    let farmer = await authService.findFarmerByEmail(email);

    if (!farmer) {
      // Create new farmer
      farmer = await authService.createFarmer(email, registrationData);
      console.log(
        `🌾 [FARMER CREATED] ${farmer.name || email} with estimated income: ₹${farmer.estimatedIncome}`,
      );

      // Send welcome email to new farmer
      try {
        await sendWelcomeEmail(
          email,
          farmer.name || "Farmer",
          farmer.estimatedIncome || 0,
        );
      } catch (emailError) {
        console.error(
          `⚠️ [WELCOME EMAIL] Failed to send welcome email to ${email}:`,
          emailError,
        );
      }

      // Notify admin about new registration
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          await emailService.sendAdminNewFarmerEmail(adminEmail, farmer as any);
        }
      } catch (notifyError) {
        console.error("⚠️ [ADMIN NOTIFY] Failed to notify admin:", notifyError);
      }
    }

    // Generate JWT token
    const token = authService.generateJWTToken(farmer.id, "farmer");

    const user: AuthUser = {
      type: "farmer",
      farmer,
    };

    console.log(`✅ [OTP VERIFICATION] Farmer authenticated: ${email}`);

    const response: LoginResponse = {
      success: true,
      user,
      token,
    };

    res.json(response);
  } catch (error) {
    console.error("❌ [OTP VERIFICATION] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const adminLogin: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`🔐 [ADMIN LOGIN] Attempt for email: ${email}`);

    if (!email || !password) {
      console.log("❌ [ADMIN LOGIN] Missing email or password");
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    // Find admin
    const admin = await authService.findAdminByEmail(email);

    if (!admin) {
      console.log(`❌ [ADMIN LOGIN] Admin not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isValidPassword = await authService.verifyUserPassword(
      admin.id,
      "admin",
      password,
    );

    if (!isValidPassword) {
      console.log(`❌ [ADMIN LOGIN] Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = authService.generateJWTToken(admin.id, "admin");

    const user: AuthUser = {
      type: "admin",
      admin,
    };

    console.log(`✅ [ADMIN LOGIN] Successful login for ${email}`);

    const response: LoginResponse = {
      success: true,
      user,
      token,
    };

    res.json(response);
  } catch (error) {
    console.error("❌ [ADMIN LOGIN] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyToken: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    // Verify JWT token and get user
    const user = await authService.getUserByToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ [VERIFY TOKEN] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateProfile: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const user = await authService.getUserByToken(token);

    if (!user || user.type !== "farmer") {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token or user type" });
    }

    const updates = req.body;
    const updatedFarmer = await authService.updateFarmer(
      user.farmer!.id,
      updates,
    );

    if (!updatedFarmer) {
      return res
        .status(404)
        .json({ success: false, message: "Farmer not found" });
    }

    const updatedUser: AuthUser = {
      type: "farmer",
      farmer: updatedFarmer,
    };

    console.log(
      `📝 [PROFILE UPDATED] ${updatedFarmer.name} - New estimated income: ₹${updatedFarmer.estimatedIncome}`,
    );

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("❌ [UPDATE PROFILE] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const logout: RequestHandler = async (req, res) => {
  try {
    // With JWT, logout is handled client-side by removing the token
    // But we can add token to a blacklist if needed in the future
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("❌ [LOGOUT] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all farmers (admin only)
export const getFarmers: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const user = await authService.getUserByToken(token);

    if (!user || user.type !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const farmers = await authService.getAllFarmers();
    res.json({ success: true, farmers });
  } catch (error) {
    console.error("❌ [GET FARMERS] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Farmer password registration
export const farmerPasswordRegister: RequestHandler = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body as FarmerPasswordRequest;

    console.log(`👨‍🌾 [FARMER REGISTER] Registration attempt for: ${email}`);

    if (!email || !password) {
      console.log("❌ [FARMER REGISTER] Missing email or password");
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    if (password.length < 6) {
      console.log("❌ [FARMER REGISTER] Password too short");
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if farmer already exists
    const existingFarmer = await authService.findFarmerByEmail(email);
    if (existingFarmer) {
      console.log(`❌ [FARMER REGISTER] Farmer already exists: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Farmer already registered with this email",
      });
    }

    // Create new farmer
    const farmerData: EnhancedFarmerRegistration = {
      name: name || email.split("@")[0],
      phone: phone || "",
      farmName: "",
      landSize: 0,
      landUnit: "acres",
      farmingType: "conventional",
      primaryCrops: [],
      irrigationType: "rain_fed",
      address: "",
      pincode: "",
      state: "",
      interestedProjects: [],
      sustainablePractices: [],
    };

    const farmer = await authService.createFarmer(email, farmerData);

    // Store password
    await authService.storePassword(farmer.id, "farmer", password);

    // Generate JWT token
    const token = authService.generateJWTToken(farmer.id, "farmer");

    const user: AuthUser = {
      type: "farmer",
      farmer,
    };

    console.log(
      `✅ [FARMER REGISTER] Farmer registered successfully: ${email}`,
    );

    // Send welcome email to new farmer
    try {
      await sendWelcomeEmail(
        email,
        farmer.name || "Farmer",
        farmer.estimatedIncome || 0,
      );
    } catch (emailError) {
      console.error(
        `⚠️ [WELCOME EMAIL] Failed to send welcome email to ${email}:`,
        emailError,
      );
    }

    // Notify admin about new registration
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await emailService.sendAdminNewFarmerEmail(adminEmail, farmer as any);
      }
    } catch (notifyError) {
      console.error("⚠️ [ADMIN NOTIFY] Failed to notify admin:", notifyError);
    }

    const response: LoginResponse = {
      success: true,
      user,
      token,
    };

    res.json(response);
  } catch (error) {
    console.error("❌ [FARMER REGISTER] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Farmer password login
export const farmerPasswordLogin: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body as FarmerLoginRequest;

    console.log(`👨‍🌾 [FARMER LOGIN] Login attempt for: ${email}`);

    if (!email || !password) {
      console.log("❌ [FARMER LOGIN] Missing email or password");
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    // Find farmer
    const farmer = await authService.findFarmerByEmail(email);
    if (!farmer) {
      console.log(`❌ [FARMER LOGIN] Farmer not found: ${email}`);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await authService.verifyUserPassword(
      farmer.id,
      "farmer",
      password,
    );

    if (!isValidPassword) {
      console.log(`❌ [FARMER LOGIN] Invalid password for: ${email}`);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = authService.generateJWTToken(farmer.id, "farmer");

    const user: AuthUser = {
      type: "farmer",
      farmer,
    };

    console.log(`✅ [FARMER LOGIN] Farmer logged in successfully: ${email}`);

    const response: LoginResponse = {
      success: true,
      user,
      token,
    };

    res.json(response);
  } catch (error) {
    console.error("❌ [FARMER LOGIN] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Social Authentication (Google OAuth implementation)
export const socialAuth: RequestHandler = async (req, res) => {
  try {
    const { provider } = req.params;
    const { access_token, credential } = req.body;

    console.log(`🔗 [SOCIAL AUTH] ${provider} authentication attempt`);

    if (provider === "google") {
      try {
        // Import Google OAuth library
        const { OAuth2Client } = await import("google-auth-library");

        // Initialize Google OAuth client
        const client = new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI ||
            "http://localhost:8080/api/auth/social/google/callback",
        );

        let payload;

        if (
          !process.env.GOOGLE_CLIENT_ID ||
          process.env.GOOGLE_CLIENT_ID === "your-google-client-id"
        ) {
          throw new Error("Google OAuth credentials not configured");
        }

        if (credential) {
          // Handle Google ID Token (from Google Sign-In)
          console.log("🔐 [GOOGLE AUTH] Verifying Google ID token");
          const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          payload = ticket.getPayload();
        } else if (access_token) {
          // Handle Access Token
          console.log("🔐 [GOOGLE AUTH] Verifying Google access token");
          const response = await fetch(
            `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`,
          );
          if (!response.ok) {
            throw new Error("Invalid access token");
          }
          payload = await response.json();
        } else {
          // Generate OAuth URL for redirect-based flow
          const authUrl = client.generateAuthUrl({
            access_type: "offline",
            scope: ["openid", "email", "profile"],
            include_granted_scopes: true,
          });

          console.log("🔗 [GOOGLE AUTH] Generated auth URL for redirect");
          return res.json({
            success: true,
            redirectUrl: authUrl,
            message: "Redirect to Google for authentication",
          });
        }

        if (!payload || !payload.email) {
          throw new Error("Unable to get user information from Google");
        }

        console.log(`✅ [GOOGLE AUTH] User verified: ${payload.email}`);

        // Find or create farmer
        let farmer = await authService.findFarmerByEmail(payload.email);

        if (!farmer) {
          // Create new farmer from Google profile
          const farmerData: EnhancedFarmerRegistration = {
            name:
              payload.name || `${payload.given_name} ${payload.family_name}`,
            phone: "",
            farmName: "",
            landSize: 0,
            landUnit: "acres",
            farmingType: "conventional",
            primaryCrops: [],
            irrigationType: "rain_fed",
            address: "",
            pincode: "",
            state: "",
            interestedProjects: [],
            sustainablePractices: [],
          };

          farmer = await authService.createFarmer(payload.email, farmerData);
          console.log(
            `🌾 [GOOGLE AUTH] New farmer created: ${farmer.name} (${farmer.email})`,
          );
        } else {
          console.log(
            `🌾 [GOOGLE AUTH] Existing farmer logged in: ${farmer.name} (${farmer.email})`,
          );
        }

        // Generate JWT token
        const token = authService.generateJWTToken(farmer.id, "farmer");

        const user: AuthUser = {
          type: "farmer",
          farmer,
        };

        const response: LoginResponse = {
          success: true,
          user,
          token,
        };

        res.json(response);
      } catch (googleError) {
        console.error("❌ [GOOGLE AUTH] Error:", googleError);
        res.status(400).json({
          success: false,
          message:
            "Google authentication failed. Please configure Google OAuth credentials or use email/password login.",
        });
      }
    } else {
      // Other providers
      res.json({
        success: false,
        message: `${provider} integration coming soon! Google login is available, or use email/password authentication.`,
      });
    }
  } catch (error) {
    console.error(`❌ [SOCIAL AUTH] Error:`, error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Social OAuth callback handler
export const socialCallback: RequestHandler = async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, error } = req.query;

    console.log(`🔗 [SOCIAL CALLBACK] ${provider} callback received`);

    if (error) {
      console.error(`❌ [SOCIAL CALLBACK] OAuth error:`, error);
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:8080"}?auth_error=${error}`,
      );
    }

    if (provider === "google" && code) {
      try {
        const { OAuth2Client } = await import("google-auth-library");

        const client = new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI ||
            "http://localhost:8080/api/auth/social/google/callback",
        );

        // Exchange code for tokens
        const { tokens } = await client.getToken(code as string);
        client.setCredentials(tokens);

        // Get user info
        const { data } = await client.request({
          url: "https://www.googleapis.com/oauth2/v2/userinfo",
        });

        const userInfo = data as any;

        if (!userInfo.email) {
          throw new Error("Unable to get user email from Google");
        }

        console.log(`✅ [GOOGLE CALLBACK] User verified: ${userInfo.email}`);

        // Find or create farmer
        let farmer = await authService.findFarmerByEmail(userInfo.email);

        if (!farmer) {
          const farmerData: EnhancedFarmerRegistration = {
            name:
              userInfo.name || `${userInfo.given_name} ${userInfo.family_name}`,
            phone: "",
            farmName: "",
            landSize: 0,
            landUnit: "acres",
            farmingType: "conventional",
            primaryCrops: [],
            irrigationType: "rain_fed",
            address: "",
            pincode: "",
            state: "",
            interestedProjects: [],
            sustainablePractices: [],
          };

          farmer = await authService.createFarmer(userInfo.email, farmerData);
          console.log(
            `🌾 [GOOGLE CALLBACK] New farmer created: ${farmer.name} (${farmer.email})`,
          );
        }

        // Generate JWT token
        const token = authService.generateJWTToken(farmer.id, "farmer");

        // Redirect to frontend with token
        const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
        res.redirect(
          `${clientUrl}/farmer-dashboard?token=${token}&auth_success=true`,
        );
      } catch (googleError) {
        console.error("❌ [GOOGLE CALLBACK] Error:", googleError);
        const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
        res.redirect(`${clientUrl}?auth_error=google_callback_failed`);
      }
    } else {
      // Other providers
      const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
      res.redirect(`${clientUrl}?auth_error=provider_not_supported`);
    }
  } catch (error) {
    console.error(`❌ [SOCIAL CALLBACK] Error:`, error);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
    res.redirect(`${clientUrl}?auth_error=callback_failed`);
  }
};

// Update farmer status (admin only)
export const updateFarmerStatus: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const user = await authService.getUserByToken(token);

    if (!user || user.type !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const { farmerId, status } = req.body;

    const updatedFarmer = await authService.updateFarmer(farmerId, {
      verified: status === "verified",
      updatedAt: new Date(),
    });

    if (!updatedFarmer) {
      return res
        .status(404)
        .json({ success: false, message: "Farmer not found" });
    }

    res.json({ success: true, farmer: updatedFarmer });
  } catch (error) {
    console.error("❌ [UPDATE FARMER STATUS] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin: create a farmer directly
export const adminAddFarmer: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const user = await authService.getUserByToken(token);
    if (!user || user.type !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { email, registrationData } = req.body as { email: string; registrationData?: Partial<EnhancedFarmerRegistration> };
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const existing = await authService.findFarmerByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: "Farmer already exists" });
    }

    const farmer = await authService.createFarmer(email, registrationData as any);

    try {
      await emailService.sendWelcomeEmail(email, farmer.name || "Farmer", farmer.estimatedIncome || 0);
    } catch (e) {
      console.error("⚠️ [WELCOME EMAIL] Failed to send welcome email:", e);
    }

    res.json({ success: true, farmer });
  } catch (error) {
    console.error("❌ [ADMIN ADD FARMER] Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
