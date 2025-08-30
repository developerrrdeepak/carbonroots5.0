import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Chrome,
  Facebook,
  Github,
  Twitter,
  Smartphone,
  Mail,
} from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [farmerAuthType, setFarmerAuthType] = useState<"otp" | "password">(
    "password",
  ); // Default to password
  const [isRegistering, setIsRegistering] = useState(false);

  const { sendOTP, verifyOTP, adminLogin, farmerRegister, farmerLogin } =
    useAuth();
  const navigate = useNavigate();

  // Social Authentication Handlers
  const handleSocialAuth = async (
    provider: "google" | "facebook" | "github" | "twitter",
  ) => {
    setLoading(true);
    try {
      if (provider === "google") {
        // Check if Google Sign-In script is loaded
        if (typeof window !== "undefined" && (window as any).google) {
          console.log("🔗 [GOOGLE AUTH] Using Google Sign-In");

          // Use Google One Tap or Sign-In button
          try {
            const { google } = window as any;

            // Initialize Google Sign-In
            google.accounts.id.initialize({
              client_id:
                import.meta.env.VITE_GOOGLE_CLIENT_ID ||
                "your-google-client-id.apps.googleusercontent.com",
              callback: async (credentialResponse: any) => {
                try {
                  console.log("🔐 [GOOGLE AUTH] Received credential response");

                  const response = await fetch(`/api/auth/social/google`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      credential: credentialResponse.credential,
                    }),
                  });

                  const result = await response.json();

                  if (result.success && result.user && result.token) {
                    // Store token and update auth state
                    localStorage.setItem("auth_token", result.token);

                    toast.success("Google login successful! 🎉");
                    onOpenChange(false);
                    navigate("/farmer-dashboard");
                  } else {
                    toast.error(result.message || "Google login failed");
                  }
                } catch (error) {
                  console.error("Google credential processing error:", error);
                  toast.error("Google authentication failed");
                }
                setLoading(false);
              },
            });

            // Prompt the user to sign in
            google.accounts.id.prompt();
          } catch (googleError) {
            console.error("Google Sign-In error:", googleError);
            // Fallback to demo login for development
            await handleDemoGoogleLogin();
          }
        } else {
          // Fallback: redirect to OAuth flow or demo login
          console.log(
            "🔗 [GOOGLE AUTH] Google Sign-In not available, using fallback",
          );
          await handleDemoGoogleLogin();
        }
      } else {
        // Other providers - show coming soon message
        toast.info(
          `${provider} integration coming soon! Use Google or email/password for now. 🚀`,
        );
        setLoading(false);
      }
    } catch (error) {
      console.error(`${provider} authentication error:`, error);
      toast.error(`${provider} authentication temporarily unavailable`);
      setLoading(false);
    }
  };

  // Demo Google login for development/testing
  const handleDemoGoogleLogin = async () => {
    try {
      const response = await fetch(`/api/auth/social/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }

      if (result.success && result.user && result.token) {
        localStorage.setItem("auth_token", result.token);
        toast.success(result.message || "Google login successful! 🎉");
        onOpenChange(false);
        navigate("/farmer-dashboard");
      } else {
        toast.error(result.message || "Google login failed");
      }
    } catch (error) {
      toast.error("Google authentication failed");
    }
    setLoading(false);
  };

  const handleSendOTP = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const result = await sendOTP({ email });
      if (result.success) {
        setOtpSent(true);
        setGeneratedOTP(result.otp || ""); // Store OTP for testing
        toast.success("OTP sent to your email");
      } else {
        toast.error(result.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Failed to send OTP");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      toast.error("Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOTP({ email, otp });
      if (result.success) {
        toast.success("Login successful!");
        onOpenChange(false);
        navigate("/farmer-dashboard");
      } else {
        toast.error(result.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error("Failed to verify OTP");
    }
    setLoading(false);
  };

  const handleFarmerPasswordAuth = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    if (isRegistering && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      let result;

      if (isRegistering) {
        // Registration
        result = await farmerRegister({
          email,
          password,
          name: name || email.split("@")[0],
          phone,
        });
        if (result.success) {
          toast.success("Registration successful! Welcome!");
          onOpenChange(false);
          navigate("/farmer-dashboard");
        } else {
          toast.error(result.message || "Registration failed");
        }
      } else {
        // Login
        result = await farmerLogin({ email, password });
        if (result.success) {
          toast.success("Login successful!");
          onOpenChange(false);
          navigate("/farmer-dashboard");
        } else {
          toast.error(result.message || "Invalid credentials");
        }
      }
    } catch (error) {
      toast.error("Failed to authenticate");
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const result = await adminLogin({ email, password });
      if (result.success) {
        toast.success("Admin login successful!");
        onOpenChange(false);
        navigate("/admin-dashboard");
      } else {
        toast.error(result.message || "Invalid credentials");
      }
    } catch (error) {
      toast.error("Failed to login");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEmail("");
    setOtp("");
    setPassword("");
    setName("");
    setPhone("");
    setOtpSent(false);
    setGeneratedOTP("");
    setIsRegistering(false);
    setFarmerAuthType("password");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="farmer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="farmer">👨‍🌾 Farmer</TabsTrigger>
            <TabsTrigger value="admin">👨‍💻 Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="farmer" className="space-y-4 mt-4">
            {/* Social Authentication Section */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  किसानों के लिए तेज़ और आस��न साइन इन
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSocialAuth("google")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 hover:bg-red-50 hover:border-red-200 transition-all duration-200"
                    >
                      <Chrome className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">Google</span>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSocialAuth("facebook")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                    >
                      <Facebook className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Facebook</span>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSocialAuth("github")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    >
                      <Github className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-medium">GitHub</span>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSocialAuth("twitter")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 hover:bg-sky-50 hover:border-sky-200 transition-all duration-200"
                    >
                      <Twitter className="w-4 h-4 text-sky-500" />
                      <span className="text-sm font-medium">Twitter</span>
                    </Button>
                  </motion.div>
                </div>
              </div>

              <div className="relative">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-white px-2 text-xs text-gray-500">
                    या
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Traditional Auth Type Selector */}
            <motion.div
              className="flex space-x-2 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Button
                variant={farmerAuthType === "password" ? "default" : "outline"}
                onClick={() => setFarmerAuthType("password")}
                className="flex-1 text-sm"
                size="sm"
              >
                <Mail className="w-4 h-4 mr-2" />
                Password Login
              </Button>
              <Button
                variant={farmerAuthType === "otp" ? "default" : "outline"}
                onClick={() => setFarmerAuthType("otp")}
                className="flex-1 text-sm"
                size="sm"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                OTP Login
              </Button>
            </motion.div>

            {farmerAuthType === "password" ? (
              // Password-based authentication
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="farmer-email">Email</Label>
                  <Input
                    id="farmer-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {isRegistering && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="farmer-name">Name (Optional)</Label>
                      <Input
                        id="farmer-name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="farmer-phone">Phone (Optional)</Label>
                      <Input
                        id="farmer-phone"
                        type="tel"
                        placeholder="Your phone number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="farmer-password">Password</Label>
                  <Input
                    id="farmer-password"
                    type="password"
                    placeholder={
                      isRegistering
                        ? "Create password (min 6 chars)"
                        : "Enter your password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleFarmerPasswordAuth}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-amber-500"
                >
                  {loading
                    ? isRegistering
                      ? "Registering..."
                      : "Signing in..."
                    : isRegistering
                      ? "Register"
                      : "Sign In"}
                </Button>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-sm text-green-600"
                  >
                    {isRegistering
                      ? "Already have an account? Sign in"
                      : "New farmer? Create account"}
                  </Button>
                </div>
              </div>
            ) : (
              // OTP-based authentication
              <>
                {!otpSent ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="farmer-email-otp">Email</Label>
                      <Input
                        id="farmer-email-otp"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-amber-500"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={6}
                      />
                      <p className="text-sm text-gray-600">
                        OTP sent to {email}
                      </p>
                      {generatedOTP && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-medium text-blue-800">
                            🔐 Your OTP:{" "}
                            <span className="font-mono text-lg">
                              {generatedOTP}
                            </span>
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            (For testing purposes only)
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={handleVerifyOTP}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-amber-500"
                      >
                        {loading ? "Verifying..." : "Verify OTP"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setOtpSent(false)}
                        className="w-full"
                      >
                        Change Email
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="admin" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="Admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAdminLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {loading ? "Signing in..." : "Admin Login"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
