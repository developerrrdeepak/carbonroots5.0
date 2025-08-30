import React, { createContext, useReducer, useEffect, useContext } from "react";
import {
  AuthState,
  AuthUser,
  LoginResponse,
  OTPRequest,
  OTPVerification,
  AdminLoginRequest,
  EnhancedFarmerRegistration,
  FarmerPasswordRequest,
  FarmerLoginRequest,
} from "@shared/auth";

interface AuthContextType extends AuthState {
  sendOTP: (
    data: OTPRequest,
  ) => Promise<{ success: boolean; message?: string; otp?: string }>;
  verifyOTP: (data: OTPVerification) => Promise<LoginResponse>;
  adminLogin: (data: AdminLoginRequest) => Promise<LoginResponse>;
  farmerRegister: (data: FarmerPasswordRequest) => Promise<LoginResponse>;
  farmerLogin: (data: FarmerLoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_USER"; payload: AuthUser | null }
  | { type: "LOGOUT" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Capture OAuth token from URL (e.g., callback redirect)
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          const urlToken = url.searchParams.get("token");
          if (urlToken) {
            localStorage.setItem("auth_token", urlToken);
            url.searchParams.delete("token");
            url.searchParams.delete("auth_success");
            window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams.toString()}` : "") + url.hash);
          }
        }

        const token = localStorage.getItem("auth_token");
        if (token) {
          const response = await fetch("/api/auth/verify", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            dispatch({ type: "SET_USER", payload: data.user });
          } else {
            localStorage.removeItem("auth_token");
            dispatch({ type: "SET_LOADING", payload: false });
          }
        } else {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    checkAuth();
  }, []);

  const sendOTP = async (data: OTPRequest) => {
    try {
      console.log("🔐 [CLIENT] Sending OTP request for:", data.email);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("📡 [CLIENT] OTP Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ [CLIENT] OTP request failed:",
          response.status,
          errorText,
        );
        return {
          success: false,
          message: `Server error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("✅ [CLIENT] OTP request successful:", result.success);
      return result;
    } catch (error) {
      console.error("❌ [CLIENT] Send OTP network error:", error);
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };

  const verifyOTP = async (data: OTPVerification): Promise<LoginResponse> => {
    try {
      console.log("🔐 [CLIENT] Verifying OTP for:", data.email);
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("📡 [CLIENT] Verify OTP Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ [CLIENT] OTP verification failed:",
          response.status,
          errorText,
        );
        dispatch({ type: "SET_LOADING", payload: false });
        return {
          success: false,
          message: `Server error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("📊 [CLIENT] OTP verification result:", {
        success: result.success,
        hasUser: !!result.user,
      });

      if (result.success && result.user) {
        localStorage.setItem("auth_token", result.token);
        dispatch({ type: "SET_USER", payload: result.user });
        console.log("✅ [CLIENT] User authenticated successfully");
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      console.error("❌ [CLIENT] OTP verification network error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };

  const adminLogin = async (
    data: AdminLoginRequest,
  ): Promise<LoginResponse> => {
    try {
      console.log("👨‍💻 [CLIENT] Admin login attempt for:", data.email);
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("📡 [CLIENT] Admin login Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ [CLIENT] Admin login failed:",
          response.status,
          errorText,
        );
        dispatch({ type: "SET_LOADING", payload: false });
        return {
          success: false,
          message: `Server error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("📊 [CLIENT] Admin login result:", {
        success: result.success,
        hasUser: !!result.user,
      });

      if (result.success && result.user) {
        localStorage.setItem("auth_token", result.token);
        dispatch({ type: "SET_USER", payload: result.user });
        console.log("✅ [CLIENT] Admin authenticated successfully");
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      console.error("❌ [CLIENT] Admin login network error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    dispatch({ type: "LOGOUT" });
  };

  const updateProfile = async (data: any) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        dispatch({ type: "SET_USER", payload: result.user });
      }
    } catch (error) {
      console.error("Profile update failed:", error);
    }
  };

  const farmerRegister = async (
    data: FarmerPasswordRequest,
  ): Promise<LoginResponse> => {
    try {
      console.log("👨‍🌾 [CLIENT] Farmer registration attempt for:", data.email);
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await fetch("/api/auth/farmer-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log(
        "📡 [CLIENT] Farmer register Response status:",
        response.status,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ [CLIENT] Farmer registration failed:",
          response.status,
          errorText,
        );
        dispatch({ type: "SET_LOADING", payload: false });
        return {
          success: false,
          message: `Server error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("📊 [CLIENT] Farmer register result:", {
        success: result.success,
        hasUser: !!result.user,
      });

      if (result.success && result.user) {
        localStorage.setItem("auth_token", result.token);
        dispatch({ type: "SET_USER", payload: result.user });
        console.log(
          "✅ [CLIENT] Farmer registered and authenticated successfully",
        );
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      console.error("❌ [CLIENT] Farmer registration network error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };

  const farmerLogin = async (
    data: FarmerLoginRequest,
  ): Promise<LoginResponse> => {
    try {
      console.log("👨‍🌾 [CLIENT] Farmer login attempt for:", data.email);
      dispatch({ type: "SET_LOADING", payload: true });

      const response = await fetch("/api/auth/farmer-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("📡 [CLIENT] Farmer login Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ [CLIENT] Farmer login failed:",
          response.status,
          errorText,
        );
        dispatch({ type: "SET_LOADING", payload: false });
        return {
          success: false,
          message: `Server error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("📊 [CLIENT] Farmer login result:", {
        success: result.success,
        hasUser: !!result.user,
      });

      if (result.success && result.user) {
        localStorage.setItem("auth_token", result.token);
        dispatch({ type: "SET_USER", payload: result.user });
        console.log("✅ [CLIENT] Farmer authenticated successfully");
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      console.error("❌ [CLIENT] Farmer login network error:", error);
      dispatch({ type: "SET_LOADING", payload: false });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };

  const value: AuthContextType = {
    ...state,
    sendOTP,
    verifyOTP,
    adminLogin,
    farmerRegister,
    farmerLogin,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
