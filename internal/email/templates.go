package email

import "fmt"

// VerificationEmail returns the HTML for the email verification message.
func VerificationEmail(name, code string) (subject, html string) {
	subject = "Verify your Tori account"
	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:#0F1728;padding:28px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:28px;height:28px;background:#0F1728;border-radius:6px;text-align:center;vertical-align:middle;">
                    <span style="color:#00B37E;font-size:16px;font-weight:900;">T</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Tori</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F1728;letter-spacing:-0.5px;">
                Verify your email address
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi %s, enter this code in Tori to verify your email address and activate your account.
              </p>
              <!-- Code box -->
              <div style="background:#f8fafc;border:2px solid #00B37E;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;">
                  Verification code
                </p>
                <p style="margin:0;font-size:40px;font-weight:900;color:#0F1728;letter-spacing:12px;font-family:monospace;">
                  %s
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                  Expires in 15 minutes
                </p>
              </div>
              <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
                If you did not create a Tori account, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                For security, never share this code with anyone. Tori staff will never ask for your verification code.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Tori — Recurring billing infrastructure for Nomba
                <br>Nomba × DevCareer Hackathon 2026
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, name, code)
	return
}

// PortalOTPEmail returns the HTML for a customer portal login code.
func PortalOTPEmail(merchantName, code string) (subject, html string) {
	subject = "Your billing portal login code"
	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0F1728;padding:28px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:28px;height:28px;background:#0F1728;border-radius:6px;text-align:center;vertical-align:middle;">
                    <span style="color:#00B37E;font-size:16px;font-weight:900;">T</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Tori</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F1728;letter-spacing:-0.5px;">
                Your billing portal login code
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Use this code to sign in to your %s billing portal.
              </p>
              <div style="background:#f8fafc;border:2px solid #00B37E;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;">
                  Login code
                </p>
                <p style="margin:0;font-size:40px;font-weight:900;color:#0F1728;letter-spacing:12px;font-family:monospace;">
                  %s
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                  Expires in 10 minutes
                </p>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by Tori — Recurring billing infrastructure for Nomba
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, merchantName, code)
	return
}

// WelcomeEmail returns the HTML for the welcome email after verification.
func WelcomeEmail(name string) (subject, html string) {
	subject = "Welcome to Tori — you're all set"
	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0F1728;padding:28px 40px;">
              <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Tori</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F1728;letter-spacing:-0.5px;">
                You're verified. Let's go.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi %s, your Tori account is now active. Here is what to do next:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;font-weight:700;color:#00B37E;">1</span>
                    <span style="font-size:14px;color:#374151;margin-left:12px;">Create a plan with your pricing and trial period</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;font-weight:700;color:#00B37E;">2</span>
                    <span style="font-size:14px;color:#374151;margin-left:12px;">Generate an API key from the dashboard</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;font-weight:700;color:#00B37E;">3</span>
                    <span style="font-size:14px;color:#374151;margin-left:12px;">Call POST /v1/platform/checkout — one call to start a subscription</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <span style="font-size:13px;font-weight:700;color:#00B37E;">4</span>
                    <span style="font-size:14px;color:#374151;margin-left:12px;">Register a webhook endpoint to receive billing events</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Questions? Reply to this email or check the docs at your dashboard.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Tori — Recurring billing infrastructure for Nomba
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, name)
	return
}

// InviteEmail returns the HTML for a team member invitation.
func InviteEmail(tenantName, inviteURL, role string) (subject, html string) {
	subject = "You've been invited to join " + tenantName + " on Tori"
	html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eaecef;">
    <div style="background:#0F1728;padding:28px 32px;">
      <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Tori<span style="color:#00B37E;">.</span></span>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:20px;font-weight:800;color:#0F1728;margin:0 0 8px;">You've been invited</h1>
      <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
        You've been invited to join <strong>` + tenantName + `</strong> on Tori as a <strong>` + role + `</strong>.
      </p>
      <a href="` + inviteURL + `"
         style="display:inline-block;background:#0F1728;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;">
        Accept invitation
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">
        This invitation expires in 72 hours. If you weren't expecting this, you can ignore it.
      </p>
    </div>
  </div>
</body>
</html>`
	return
}
