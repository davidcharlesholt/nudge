// src/lib/email.js
import { Resend } from "resend";
import { formatCurrency } from "@/lib/utils";

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment");
}

if (!process.env.RESEND_FROM_EMAIL) {
  throw new Error("Missing RESEND_FROM_EMAIL in environment");
}

// RESEND_FROM_NAME is optional; we'll use "Nudge" as fallback
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sanitize a string for use in email headers
 * Removes newlines, carriage returns, and other control characters
 * that could be used for header injection attacks
 */
function sanitizeForEmailHeader(str) {
  if (!str) return "";
  // Remove newlines, carriage returns, tabs, and other control chars
  return str.replace(/[\r\n\t\x00-\x1f\x7f]/g, "").trim();
}

/**
 * Escape HTML special characters to prevent XSS in email content
 */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendTestEmail(to, fromName) {
  const fallbackFromName = process.env.RESEND_FROM_NAME || "Nudge";
  const finalFromName = sanitizeForEmailHeader(fromName || fallbackFromName);
  const from = `${finalFromName} <${process.env.RESEND_FROM_EMAIL}>`;

  const res = await resend.emails.send({
    from,
    to,
    subject: "Nudge test email",
    text: "If you're seeing this, Resend is wired up correctly 🎉",
  });

  // Check for Resend error
  if (res?.error) {
    console.error("Failed to send test email");
    throw new Error(res.error.message || "Failed to send email via Resend");
  }

  return res;
}

/**
 * Send an invoice email with placeholders replaced
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string[]} params.ccEmails - CC email addresses
 * @param {string} params.subject - Email subject with placeholders
 * @param {string} params.body - Email body with placeholders
 * @param {Object} params.client - Client object with firstName, fullName
 * @param {number} params.amountCents - Invoice amount in cents
 * @param {string} params.dueDate - Due date string
 * @param {string} params.paymentLink - Payment URL
 * @param {string} params.yourName - Sender's name (for email sign-off)
 * @param {string} params.fromName - Sender's display name (for email From header)
 * @param {string} params.replyTo - Email address for replies (optional)
 */
export async function sendInvoiceEmail({
  to,
  ccEmails = [],
  subject,
  body,
  client,
  amountCents,
  dueDate,
  paymentLink,
  yourName,
  fromName,
  replyTo,
}) {
  // Format amount as dollars with comma separators
  const amount = `$${formatCurrency(amountCents / 100)}`;

  // Parse and format due date
  const dueDateObj = new Date(dueDate);
  const formattedDueDate = isNaN(dueDateObj)
    ? dueDate
    : dueDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  const dayOfWeek = isNaN(dueDateObj)
    ? ""
    : dueDateObj.toLocaleDateString("en-US", { weekday: "long" });

  // Replace placeholders in subject (sanitize for header injection)
  const replaceSubjectPlaceholders = (text) => {
    return text
      .replace(/\{\{clientName\}\}/g, sanitizeForEmailHeader(client.fullName || ""))
      .replace(/\{\{clientFirstName\}\}/g, sanitizeForEmailHeader(client.firstName || ""))
      .replace(/\{\{amount\}\}/g, amount)
      .replace(/\{\{dueDate\}\}/g, formattedDueDate)
      .replace(/\{\{paymentLink\}\}/g, sanitizeForEmailHeader(paymentLink))
      .replace(/\{\{yourName\}\}/g, sanitizeForEmailHeader(yourName || ""))
      .replace(/\{\{dayOfWeek\}\}/g, dayOfWeek);
  };

  // Replace placeholders in body (escape HTML to prevent XSS)
  const replaceBodyPlaceholders = (text) => {
    return text
      .replace(/\{\{clientName\}\}/g, escapeHtml(client.fullName || ""))
      .replace(/\{\{clientFirstName\}\}/g, escapeHtml(client.firstName || ""))
      .replace(/\{\{amount\}\}/g, escapeHtml(amount))
      .replace(/\{\{dueDate\}\}/g, escapeHtml(formattedDueDate))
      .replace(/\{\{paymentLink\}\}/g, escapeHtml(paymentLink))
      .replace(/\{\{yourName\}\}/g, escapeHtml(yourName || ""))
      .replace(/\{\{dayOfWeek\}\}/g, escapeHtml(dayOfWeek));
  };

  const finalSubject = replaceSubjectPlaceholders(subject);
  const finalBody = replaceBodyPlaceholders(body);

  // Convert body to HTML (preserve line breaks)
  const htmlBody = finalBody.replace(/\n/g, "<br>");

  // Build From header with company/sender name and fallbacks (sanitized)
  const fallbackFromName = process.env.RESEND_FROM_NAME || "Nudge";
  const finalFromName = sanitizeForEmailHeader(fromName || fallbackFromName);
  const from = `${finalFromName} <${process.env.RESEND_FROM_EMAIL}>`;

  const emailData = {
    from,
    to: [to],
    subject: finalSubject,
    html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">${htmlBody}</div>`,
  };

  // Add reply-to if provided (so clients can reply directly to the user)
  if (replyTo && replyTo.trim()) {
    const replyToEmail = sanitizeForEmailHeader(replyTo.trim());
    emailData.reply_to = replyToEmail;
    emailData.replyTo = replyToEmail;
    emailData.headers = {
      ...(emailData.headers || {}),
      "Reply-To": replyToEmail,
    };
  }
  // Add CC emails if provided (sanitize each email)
  if (ccEmails && ccEmails.length > 0) {
    emailData.cc = ccEmails
      .filter((email) => email && email.trim())
      .map((email) => sanitizeForEmailHeader(email.trim()));
  }

  // Send email and check for errors
  const res = await resend.emails.send(emailData);

  // Resend SDK doesn't throw on errors - it returns them in res.error
  if (res?.error) {
    console.error("Failed to send invoice email");
    throw new Error(res.error.message || "Failed to send email via Resend");
  }

  return res;
}

/**
 * Send the beta welcome email to a new user
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.displayName - User's display name (optional, for personalization)
 */
export async function sendBetaWelcomeEmail({ to, displayName }) {
  const fromName = "David from Nudge";
  const from = `${fromName} <${process.env.RESEND_FROM_EMAIL}>`;

  const subject = "Welcome to the Nudge beta 🎉";

  const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="margin-bottom: 16px;">Greetings fellow freelancer 🖖🏼</p>

  <p style="margin-bottom: 16px;">Thanks for joining the Nudge beta — I really appreciate it.</p>

  <p style="margin-bottom: 16px;">I built Nudge because I got tired of chasing clients about invoices. I'm sure you know the feeling… you finish the project, send the invoice, and then you're stuck wondering when (or if) they'll actually pay you. And writing those follow-up emails always feels weird and awkward.</p>

  <p style="margin-bottom: 16px;">Nudge basically handles that part for you.</p>

  <p style="margin-bottom: 16px;">You add a client, make an invoice, and if the payment doesn't come in, Nudge sends a friendly, human-sounding reminder. Nothing robotic or stiff — just the kind of message you'd normally send yourself, minus the mental load and the awkwardness.</p>

  <p style="margin-bottom: 16px;"><strong>Here's the easiest way to try it:</strong></p>

  <ol style="margin-bottom: 16px; padding-left: 24px;">
    <li style="margin-bottom: 8px;">Add a real client you work with</li>
    <li style="margin-bottom: 8px;">Create an invoice you actually plan to send (you still use your invoicing software, just copy and paste the payment link into Nudge)</li>
    <li style="margin-bottom: 8px;">Craft the email message reminders exactly how you want (or use AI to get you started)</li>
    <li style="margin-bottom: 8px;">Nudge will send the initial invoice and then the follow-up if they don't pay on time</li>
  </ol>

  <p style="margin-bottom: 16px;">During the beta, everything is free. I'm mostly just hoping to hear what feels good, what feels confusing, and what could be better. Anything you notice is super helpful — even tiny things.</p>

  <p style="margin-bottom: 16px;"><strong>You can reply directly to this email and it comes straight to me.</strong></p>

  <p style="margin-bottom: 16px;">Thanks again for giving this a shot.</p>

  <p style="margin-bottom: 4px;">David</p>
  <p style="margin: 0; color: #666;">Founder of Nudge</p>
</div>
  `.trim();

  const emailData = {
    from,
    to: [to],
    subject,
    html: htmlBody,
    reply_to: process.env.RESEND_FROM_EMAIL, // Replies go to David
  };

  const res = await resend.emails.send(emailData);

  if (res?.error) {
    console.error("Failed to send beta welcome email");
    throw new Error(res.error.message || "Failed to send welcome email via Resend");
  }

  return res;
}
