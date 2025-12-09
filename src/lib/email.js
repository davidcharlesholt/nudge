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
