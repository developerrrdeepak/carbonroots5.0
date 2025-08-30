import sgMail from "@sendgrid/mail";

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private static instance: EmailService;
  private isConfigured: boolean = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initialize(): void {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (apiKey && apiKey !== "your-sendgrid-api-key") {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      console.log("✅ [EMAIL SERVICE] SendGrid configured successfully");
    } else {
      this.isConfigured = false;
      console.log(
        "⚠️ [EMAIL SERVICE] SendGrid API key not configured - emails will be logged to console",
      );
    }
  }

  // OTP Email Template
  private createOTPTemplate(email: string, otp: string): EmailTemplate {
    return {
      subject: "Carbon Roots - आपका OTP Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Carbon Roots OTP</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8f9fa;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 16px;
            }
            .content {
              padding: 40px 30px;
            }
            .otp-container {
              background: #f8fafc;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              padding: 30px;
              text-align: center;
              margin: 25px 0;
            }
            .otp-label {
              font-size: 16px;
              color: #64748b;
              margin-bottom: 15px;
              font-weight: 500;
            }
            .otp-code {
              font-size: 36px;
              font-weight: 800;
              color: #059669;
              letter-spacing: 8px;
              font-family: 'Monaco', 'Menlo', monospace;
              margin: 0;
            }
            .otp-timer {
              color: #ef4444;
              font-size: 14px;
              margin-top: 15px;
              font-weight: 600;
            }
            .instructions {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 25px 0;
              border-radius: 6px;
            }
            .instructions h3 {
              margin: 0 0 10px 0;
              color: #92400e;
              font-size: 16px;
            }
            .instructions p {
              margin: 0;
              color: #92400e;
              font-size: 14px;
            }
            .footer {
              background: #f1f5f9;
              padding: 25px 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 0;
              color: #64748b;
              font-size: 14px;
            }
            .logo {
              font-size: 24px;
              font-weight: 900;
              margin-bottom: 5px;
            }
            .tagline {
              font-size: 14px;
              opacity: 0.8;
            }
            .security-notice {
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .security-notice p {
              margin: 0;
              color: #dc2626;
              font-size: 13px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🌱 Carbon Roots</div>
              <p class="tagline">किसानों के लिए Carbon Income का नया रास्ता</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1f2937; margin: 0 0 20px 0;">Login Verification</h2>
              <p style="color: #4b5563; font-size: 16px;">
                नमस्ते! आपका OTP verification code तैयार है।
              </p>
              
              <div class="otp-container">
                <div class="otp-label">आपका OTP Code है:</div>
                <div class="otp-code">${otp}</div>
                <div class="otp-timer">⏰ यह OTP केवल 5 मिनट के लिए valid है</div>
              </div>
              
              <div class="instructions">
                <h3>�� कैसे use करें:</h3>
                <p>1. Carbon Roots app में वापस जाएं<br>
                2. यह 6-digit code enter करें<br>
                3. "Verify OTP" पर click करें</p>
              </div>
              
              <div class="security-notice">
                <p>🛡️ Security Notice: अगर आपने यह OTP request नहीं किया है, तो इस email को ignore करें।</p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Carbon Roots platform में आपका स्वागत है! हमारे साथ sustainable farming की शुरुआत करें।
              </p>
            </div>
            
            <div class="footer">
              <p><strong>Carbon Roots</strong> - Sustainable Farming Solutions</p>
              <p>किसानों को carbon credits से extra income दिलाने में मदद करते हैं</p>
              <p style="margin-top: 15px; font-size: 12px;">
                यह एक automated email है। कृपया reply न करें।
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Carbon Roots - OTP Verification

नमस्ते!

आपका OTP verification code: ${otp}

यह code केवल 5 मिनट के लिए valid है।

कैसे use करें:
1. Carbon Roots app में वापस जाएं
2. यह 6-digit code enter करें  
3. "Verify OTP" पर click करें

अगर आपने यह OTP request नहीं किया है, तो इस email को ignore करें।

Carbon Roots
किसानों के लिए Carbon Income का नया रास्ता
      `,
    };
  }

  // Welcome Email Template
  private createWelcomeTemplate(
    farmerName: string,
    estimatedIncome: number,
  ): EmailTemplate {
    return {
      subject: "Carbon Roots में आपका स्वागत है! 🌱",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Carbon Roots</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8f9fa;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .content {
              padding: 40px 30px;
            }
            .income-highlight {
              background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
              color: white;
              padding: 25px;
              border-radius: 12px;
              text-align: center;
              margin: 25px 0;
            }
            .feature-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 30px 0;
            }
            .feature-item {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #10b981;
            }
            .cta-button {
              background: #10b981;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              display: inline-block;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              background: #f1f5f9;
              padding: 25px 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 32px;">🌱 Carbon Roots में आपका स्वागत है!</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">
                ${farmerName}, sustainable farming की नई ��ुरुआत करें
              </p>
            </div>
            
            <div class="content">
              <p style="font-size: 18px; color: #374151;">
                बधाई हो! आपका Carbon Roots account successfully create हो गया है।
              </p>
              
              <div class="income-highlight">
                <h2 style="margin: 0 0 10px 0; font-size: 24px;">💰 आपकी Estimated Monthly Income</h2>
                <div style="font-size: 36px; font-weight: 800; margin: 10px 0;">₹${estimatedIncome.toLocaleString()}</div>
                <p style="margin: 0; opacity: 0.9;">Carbon credits से हर महीने</p>
              </div>
              
              <h3 style="color: #1f2937; margin: 30px 0 20px 0;">🚀 अब क्या करें:</h3>
              
              <div class="feature-grid">
                <div class="feature-item">
                  <h4 style="margin: 0 0 10px 0; color: #059669;">📋 Profile Complete करें</h4>
                  <p style="margin: 0; font-size: 14px;">अपनी farming details और documents upload करें</p>
                </div>
                
                <div class="feature-item">
                  <h4 style="margin: 0 0 10px 0; color: #059669;">🌾 Projects Join करें</h4>
                  <p style="margin: 0; font-size: 14px;">Carbon farming projects में participate करें</p>
                </div>
                
                <div class="feature-item">
                  <h4 style="margin: 0 0 10px 0; color: #059669;">💳 Income Track करें</h4>
                  <p style="margin: 0; font-size: 14px;">अपनी carbon credits और payments monitor करें</p>
                </div>
                
                <div class="feature-item">
                  <h4 style="margin: 0 0 10px 0; color: #059669;">🤖 AI Assistant</h4>
                  <p style="margin: 0; font-size: 14px;">Kisan AI से farming guidance लें</p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/farmer-dashboard" class="cta-button">
                  Dashboard में जाएं →
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                कोई सवाल है? हमारे customer support team स�� 24/7 बात करें।
              </p>
            </div>
            
            <div class="footer">
              <p><strong>Carbon Roots</strong> - Sustainable Farming Solutions</p>
              <p>किसानों को carbon credits से extra income दिलाने में मदद करते हैं</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Carbon Roots में आपका स्वागत है!

${farmerName}, बधाई हो! आपका account successfully create हो गया है।

आपकी Estimated Monthly Income: ₹${estimatedIncome.toLocaleString()}
(Carbon credits से हर महीने)

अब क्या करें:
• Profile complete करें
• Carbon farming projects join करें  
• Income track करें
• AI Assistant से guidance लें

Dashboard में जाएं: ${process.env.CLIENT_URL || "http://localhost:8080"}/farmer-dashboard

Carbon Roots - किसानों के लिए Carbon Income का नया रास्ता
      `,
    };
  }

  // Send OTP Email
  async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        // Development mode - log to console
        console.log(`\n🔐 [OTP EMAIL] Sending to: ${email}`);
        console.log(`📧 [OTP CODE]: ${otp}`);
        console.log(`⏰ [EXPIRES]: 5 minutes\n`);
        return true;
      }

      const template = this.createOTPTemplate(email, otp);

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@carbonroots.com",
          name: "Carbon Roots",
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await sgMail.send(msg);
      console.log(`✅ [SENDGRID] OTP email sent successfully to ${email}`);
      return true;
    } catch (error) {
      console.error(
        `❌ [SENDGRID] Failed to send OTP email to ${email}:`,
        error,
      );

      // Fallback to console logging in case of SendGrid failure
      console.log(`\n🔐 [OTP FALLBACK] Email: ${email}`);
      console.log(`📧 [OTP CODE]: ${otp}`);
      console.log(`⏰ [EXPIRES]: 5 minutes\n`);

      return false;
    }
  }

  // Send Welcome Email
  async sendWelcomeEmail(
    email: string,
    farmerName: string,
    estimatedIncome: number = 0,
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log(
          `\n🎉 [WELCOME EMAIL] Would send to: ${email} (${farmerName})`,
        );
        console.log(`💰 [ESTIMATED INCOME]: ₹${estimatedIncome}\n`);
        return true;
      }

      const template = this.createWelcomeTemplate(farmerName, estimatedIncome);

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@carbonroots.com",
          name: "Carbon Roots",
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await sgMail.send(msg);
      console.log(`✅ [SENDGRID] Welcome email sent successfully to ${email}`);
      return true;
    } catch (error) {
      console.error(
        `❌ [SENDGRID] Failed to send welcome email to ${email}:`,
        error,
      );
      return false;
    }
  }

  // Send Password Reset Email
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log(`\n🔐 [PASSWORD RESET] Would send to: ${email}`);
        console.log(`🔑 [RESET TOKEN]: ${resetToken}\n`);
        return true;
      }

      const resetUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/reset-password?token=${resetToken}`;

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@carbonroots.com",
          name: "Carbon Roots",
        },
        subject: "Carbon Roots - Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Password Reset Request</h2>
            <p>आपने password reset की request की है।</p>
            <p>नीचे दिए गए link पर click करके नया password set ���रें:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                Reset Password
              </a>
            </div>
            <p>यह link 1 घंटे के लिए valid है।</p>
            <p>अगर आपने यह request नहीं की है, तो इस email को ignore करें।</p>
            <hr style="margin: 30px 0;">
            <p style="color: #6b7280; font-size: 14px;">Carbon Roots - किसानों के लिए Carbon Income का नया रास्ता</p>
          </div>
        `,
        text: `
Password Reset Request

आपने Carbon Roots के लिए password reset की request की है।

Reset करने के लिए इस link पर जाएं: ${resetUrl}

यह link 1 घंटे के लिए valid है।

अ��र आपने यह request नहीं की है, तो इस email को ignore करें।

Carbon Roots
        `,
      };

      await sgMail.send(msg);
      console.log(
        `✅ [SENDGRID] Password reset email sent successfully to ${email}`,
      );
      return true;
    } catch (error) {
      console.error(
        `❌ [SENDGRID] Failed to send password reset email to ${email}:`,
        error,
      );
      return false;
    }
  }

  // Admin notification for new farmer registration
  async sendAdminNewFarmerEmail(
    adminEmail: string,
    farmer: { email: string; name?: string; phone?: string; location?: any; createdAt?: Date },
  ): Promise<boolean> {
    try {
      const subject = `New Farmer Registration: ${farmer.name || farmer.email}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style=\"color:#065f46;\">New Farmer Registration</h2>
          <p>A new farmer has registered on the platform. Review and verify in the Admin Dashboard.</p>
          <div style=\"background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px;\">
            <p><strong>Name:</strong> ${farmer.name || "-"}</p>
            <p><strong>Email:</strong> ${farmer.email}</p>
            <p><strong>Phone:</strong> ${farmer.phone || "-"}</p>
            <p><strong>Location:</strong> ${typeof farmer.location === "string" ? farmer.location : (farmer.location?.state || farmer.location?.pincode || "-")}</p>
            <p><strong>Registered At:</strong> ${(farmer.createdAt ? new Date(farmer.createdAt) : new Date()).toISOString()}</p>
          </div>
          <p style=\"margin-top:16px;\">
            Open Admin Dashboard: ${(process.env.CLIENT_URL || "http://localhost:8080")}/admin
          </p>
        </div>
      `;

      if (!this.isConfigured) {
        console.log(`\n📣 [ADMIN NOTIFY] New farmer registered: ${farmer.email}`);
        return true;
      }

      await sgMail.send({
        to: adminEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@carbonroots.com",
          name: "Carbon Roots",
        },
        subject,
        html,
      });
      console.log(`✅ [SENDGRID] Admin notified for new farmer: ${farmer.email}`);
      return true;
    } catch (error) {
      console.error("❌ [SENDGRID] Failed to send admin notification:", error);
      return false;
    }
  }

  // Check if SendGrid is properly configured
  isReady(): boolean {
    return this.isConfigured;
  }

  // Get configuration status
  getStatus(): { configured: boolean; provider: string } {
    return {
      configured: this.isConfigured,
      provider: this.isConfigured ? "SendGrid" : "Console (Development)",
    };
  }
}

export default EmailService;
