package email

import (
	"fmt"
	"strings"
)

// MerchantEmailVars are the variables available to both default and
// merchant-customized email templates.
type MerchantEmailVars struct {
	CustomerEmail   string
	PlanName        string
	AmountKobo      int64
	NextBillingDate string
	PayLink         string
	ProductName     string // the tenant's own business name, not "Tori"
}

// formatNaira renders a kobo amount as a comma-grouped Naira string, e.g.
// 150000000 kobo -> "₦1,500,000".
func formatNaira(kobo int64) string {
	naira := kobo / 100
	s := fmt.Sprintf("%d", naira)
	n := len(s)
	if n <= 3 {
		return "₦" + s
	}
	var parts []string
	for n > 3 {
		parts = append([]string{s[n-3:]}, parts...)
		s = s[:n-3]
		n = len(s)
	}
	parts = append([]string{s}, parts...)
	return "₦" + strings.Join(parts, ",")
}

// merchantShell wraps event-specific body HTML in the shared branded layout.
// The header shows the tenant's own product name, since these emails go to
// the tenant's customers, not Tori's. Tori is credited only in the footer.
func merchantShell(productName, heading, bodyHTML string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0F1728;padding:24px 40px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">%s</span>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#0F1728;">%s</p>
          %s
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Powered by Tori</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, productName, heading, bodyHTML)
}

// DefaultSubscriptionActivatedEmail: welcome, you're subscribed.
func DefaultSubscriptionActivatedEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Welcome to %s", v.ProductName)
	body := fmt.Sprintf(`<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">You're subscribed to <strong>%s</strong>. Your subscription is now active.</p>`, v.PlanName)
	html = merchantShell(v.ProductName, "You're subscribed", body)
	return
}

// DefaultPaymentSucceededEmail: receipt with amount and next billing date.
func DefaultPaymentSucceededEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Payment received for %s", v.ProductName)
	body := fmt.Sprintf(`
		<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">We received your payment for <strong>%s</strong>.</p>
		<div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:16px;">
			<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;">Amount charged</p>
			<p style="margin:0;font-size:24px;font-weight:800;color:#0F1728;">%s</p>
		</div>
		<p style="margin:0;font-size:14px;color:#6b7280;">Next billing date: <strong>%s</strong></p>`,
		v.PlanName, formatNaira(v.AmountKobo), v.NextBillingDate)
	html = merchantShell(v.ProductName, "Payment received", body)
	return
}

// DefaultPaymentFailedEmail: payment failed, here's what happens next.
func DefaultPaymentFailedEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Payment failed for %s", v.ProductName)
	body := fmt.Sprintf(`
		<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Your last payment for <strong>%s</strong> did not go through.</p>
		<p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">This can happen for a few reasons: insufficient funds, an expired card, or a temporary bank issue. We will automatically retry the charge over the next few days.</p>
		<p style="margin:0;font-size:14px;color:#6b7280;">No action is needed from you right now. If the retries do not succeed, we will reach out with a way to update your payment method.</p>`,
		v.PlanName)
	html = merchantShell(v.ProductName, "Payment did not go through", body)
	return
}

// DefaultDunningStartedEmail: we're retrying your payment.
func DefaultDunningStartedEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("We're retrying your payment for %s", v.ProductName)
	body := fmt.Sprintf(`
		<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">We are retrying your payment for <strong>%s</strong> on a schedule aligned with typical bank processing windows.</p>
		<p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">Your access continues while we retry. If you would like to update your payment method before the next attempt, you can do so from your account.</p>`,
		v.PlanName)
	html = merchantShell(v.ProductName, "Retrying your payment", body)
	return
}

// DefaultPaymentActionRequiredEmail: action needed, pay via this link.
func DefaultPaymentActionRequiredEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Action needed on your %s subscription", v.ProductName)
	payLinkHTML := ""
	if v.PayLink != "" {
		payLinkHTML = fmt.Sprintf(`<a href="%s" style="display:inline-block;background:#0F1728;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;">Complete payment</a>`, v.PayLink)
	}
	body := fmt.Sprintf(`
		<p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">We were not able to automatically charge your card for <strong>%s</strong>. Please complete payment manually to keep your subscription active.</p>
		%s`, v.PlanName, payLinkHTML)
	html = merchantShell(v.ProductName, "Action needed", body)
	return
}

// DefaultSubscriptionCancelledEmail: cancellation confirmed, access until [date].
func DefaultSubscriptionCancelledEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Your %s subscription is cancelled", v.ProductName)
	accessLine := ""
	if v.NextBillingDate != "" {
		accessLine = fmt.Sprintf(`<p style="margin:0;font-size:14px;color:#6b7280;">You will keep access until <strong>%s</strong>.</p>`, v.NextBillingDate)
	}
	body := fmt.Sprintf(`
		<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Your <strong>%s</strong> subscription has been cancelled, as requested.</p>
		%s`, v.PlanName, accessLine)
	html = merchantShell(v.ProductName, "Cancellation confirmed", body)
	return
}

// DefaultTrialEndingSoonEmail: your trial ends in 3 days.
func DefaultTrialEndingSoonEmail(v MerchantEmailVars) (subject, html string) {
	subject = fmt.Sprintf("Your %s trial ends in 3 days", v.ProductName)
	body := fmt.Sprintf(`
		<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Your free trial of <strong>%s</strong> ends in 3 days, on <strong>%s</strong>.</p>
		<p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">Your card on file will be charged %s automatically when the trial ends. No action is needed if you would like to continue.</p>`,
		v.PlanName, v.NextBillingDate, formatNaira(v.AmountKobo))
	html = merchantShell(v.ProductName, "Your trial is ending soon", body)
	return
}

// SupportedMerchantEmailEvents lists every event type a tenant can configure
// a merchant email template for.
var SupportedMerchantEmailEvents = []string{
	"subscription.activated",
	"payment.succeeded",
	"payment.failed",
	"dunning.started",
	"payment.action_required",
	"subscription.cancelled",
	"trial.ending_soon",
}

// DefaultMerchantTemplate renders the built-in default template for an event
// type. ok is false if the event type has no merchant email at all.
func DefaultMerchantTemplate(eventType string, v MerchantEmailVars) (subject, html string, ok bool) {
	switch eventType {
	case "subscription.activated":
		subject, html = DefaultSubscriptionActivatedEmail(v)
	case "payment.succeeded":
		subject, html = DefaultPaymentSucceededEmail(v)
	case "payment.failed":
		subject, html = DefaultPaymentFailedEmail(v)
	case "dunning.started":
		subject, html = DefaultDunningStartedEmail(v)
	case "payment.action_required":
		subject, html = DefaultPaymentActionRequiredEmail(v)
	case "subscription.cancelled":
		subject, html = DefaultSubscriptionCancelledEmail(v)
	case "trial.ending_soon":
		subject, html = DefaultTrialEndingSoonEmail(v)
	default:
		return "", "", false
	}
	return subject, html, true
}

// RenderMerchantTemplate substitutes {{variable}} placeholders in a
// merchant-customized subject or HTML body.
func RenderMerchantTemplate(text string, v MerchantEmailVars) string {
	r := strings.NewReplacer(
		"{{customer_email}}", v.CustomerEmail,
		"{{plan_name}}", v.PlanName,
		"{{amount}}", formatNaira(v.AmountKobo),
		"{{next_billing_date}}", v.NextBillingDate,
		"{{pay_link}}", v.PayLink,
		"{{product_name}}", v.ProductName,
	)
	return r.Replace(text)
}
