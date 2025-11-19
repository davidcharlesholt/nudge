// src/lib/email.js
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment");
}

if (!process.env.RESEND_FROM_EMAIL) {
  throw new Error("Missing RESEND_FROM_EMAIL in environment");
}

// RESEND_FROM_NAME is optional; we'll use "Nudge" as fallback
export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTestEmail(to, fromName) {
  const fallbackFromName = process.env.RESEND_FROM_NAME || "Nudge";
  const finalFromName = fromName || fallbackFromName;
  const from = `${finalFromName} <${process.env.RESEND_FROM_EMAIL}>`;
  
  return resend.emails.send({
    from,
    to,
    subject: "Nudge test email",
    text: "If you're seeing this, Resend is wired up correctly 🎉",
  });
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
}) {
  // Format amount as dollars
  const amount = `$${(amountCents / 100).toFixed(2)}`;

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

  // Replace placeholders in subject and body
  const replacePlaceholders = (text) => {
    return text
      .replace(/\{\{clientName\}\}/g, client.fullName || "")
      .replace(/\{\{clientFirstName\}\}/g, client.firstName || "")
      .replace(/\{\{amount\}\}/g, amount)
      .replace(/\{\{dueDate\}\}/g, formattedDueDate)
      .replace(/\{\{paymentLink\}\}/g, paymentLink)
      .replace(/\{\{yourName\}\}/g, yourName || "")
      .replace(/\{\{dayOfWeek\}\}/g, dayOfWeek);
  };

  const finalSubject = replacePlaceholders(subject);
  const finalBody = replacePlaceholders(body);

  // Convert body to HTML (preserve line breaks)
  const htmlBody = finalBody.replace(/\n/g, "<br>");

  // Build From header with company/sender name and fallbacks
  const fallbackFromName = process.env.RESEND_FROM_NAME || "Nudge";
  const finalFromName = fromName || fallbackFromName;
  const from = `${finalFromName} <${process.env.RESEND_FROM_EMAIL}>`;

  const emailData = {
    from,
    to: [to],
    subject: finalSubject,
    html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">${htmlBody}</div>`,
  };

  // Add CC emails if provided
  if (ccEmails && ccEmails.length > 0) {
    emailData.cc = ccEmails.filter((email) => email && email.trim());
  }

  return resend.emails.send(emailData);
}
