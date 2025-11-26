// Cron API route for automatic daily invoice reminders
// Intended to be called by Vercel Cron once per day
// Usage: GET /api/cron/reminders?secret=YOUR_CRON_SECRET

import clientPromise from "@/lib/db";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";

/**
 * Helper to format a Date as "YYYY-MM-DD" in UTC
 */
function formatYMD(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper to parse "YYYY-MM-DD" string into a Date object (UTC)
 */
function parseYMD(ymdString) {
  const [year, month, day] = ymdString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Helper to add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export async function GET(req) {
  try {
    // Check CRON_SECRET
    if (!process.env.CRON_SECRET) {
      throw new Error("CRON_SECRET environment variable is not set");
    }

    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    // Get today's date in YYYY-MM-DD format (UTC)
    const today = formatYMD(new Date());

    // Find all invoices that are "sent" or "overdue"
    const invoices = await db
      .collection("invoices")
      .find({
        status: { $in: ["sent", "overdue"] },
      })
      .toArray();

    let processedCount = 0;
    let remindersSentCount = 0;

    // Process each invoice
    for (const invoice of invoices) {
      try {
        processedCount++;

        // Skip if no templates or dueDate
        if (!invoice.templates || !invoice.dueDate) {
          continue;
        }

        // Parse due date
        const dueDate = parseYMD(invoice.dueDate);
        const remindersSent = invoice.remindersSent || [];

        // SAFETY GUARD B: Skip very old invoices (older than ~6 months)
        // This prevents sending reminders for invoices that are likely abandoned or resolved
        const now = new Date();
        const invoiceAgeMs = now.getTime() - dueDate.getTime();
        const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months in milliseconds
        if (invoiceAgeMs > sixMonthsMs) {
          console.log(
            `Skipping invoice ${invoice._id}: invoice is older than 6 months (due date: ${invoice.dueDate})`
          );
          continue;
        }

        // SAFETY GUARD A: Never send more than 1 reminder per invoice per day
        // Check if any reminder was already sent today for this invoice
        // This prevents duplicate sends if the cron runs multiple times or if there's a bug
        const hasReminderSentToday = remindersSent.some((sent) => {
          if (!sent.sentAt) return false;
          // Handle both Date objects and ISO strings
          const sentDate =
            sent.sentAt instanceof Date
              ? sent.sentAt
              : typeof sent.sentAt === "string"
              ? new Date(sent.sentAt)
              : null;
          if (!sentDate || isNaN(sentDate.getTime())) return false;
          const sentDateStr = formatYMD(sentDate);
          return sentDateStr === today;
        });

        if (hasReminderSentToday) {
          console.log(
            `Skipping invoice ${invoice._id}: a reminder was already sent today`
          );
          continue;
        }

        // Find reminders due today
        const remindersToSend = [];

        for (const template of invoice.templates) {
          // Only process reminder templates (not "initial")
          if (!template.id || !template.id.startsWith("reminder")) {
            continue;
          }

          // Skip if offset is null or undefined
          if (template.offset == null) {
            continue;
          }

          // Calculate target date for this reminder
          const targetDate = addDays(dueDate, template.offset);
          const targetDateStr = formatYMD(targetDate);

          // Check if this reminder is due today
          if (targetDateStr !== today) {
            continue;
          }

          // Check if already sent
          const alreadySent = remindersSent.some(
            (sent) => sent.id === template.id
          );
          if (alreadySent) {
            continue;
          }

          // This reminder should be sent
          remindersToSend.push(template);
        }

        // Send each reminder
        for (const template of remindersToSend) {
          try {
            // Fetch client data
            const clientDoc = await db.collection("clients").findOne({
              _id: invoice.clientId,
              userId: invoice.userId,
            });

            if (!clientDoc) {
              console.error(
                `Client not found for invoice ${invoice._id}, clientId: ${invoice.clientId}`
              );
              continue;
            }

            // Fetch workspace for sender names
            const workspace = await db
              .collection("workspaces")
              .findOne({ userId: invoice.userId });
            const companyName =
              workspace?.workspaceName || workspace?.companyName;
            const displayName = workspace?.displayName;
            const fromName = companyName || displayName || "Nudge";
            const yourName = displayName || companyName || "Nudge";

            // Get user's email from Clerk for reply-to
            // NOTE: Cron has no user context, so we must use clerkClient.users.getUser()
            let userEmail = null;
            try {
              const user = await clerkClient.users.getUser(invoice.userId);
              userEmail = user?.emailAddresses?.find(
                (email) => email.id === user.primaryEmailAddressId
              )?.emailAddress;
              console.log("INVOICE EMAIL → userEmail from clerkClient:", userEmail);
            } catch (clerkError) {
              console.warn("Could not fetch user email via clerkClient:", clerkError);
            }

            // Send the email
            await sendInvoiceEmail({
              to: clientDoc.email,
              ccEmails: invoice.ccEmails || [],
              subject: template.subject,
              body: template.body,
              client: {
                firstName: clientDoc.firstName,
                fullName: clientDoc.fullName,
              },
              amountCents: invoice.amountCents,
              dueDate: invoice.dueDate,
              paymentLink: invoice.paymentLink,
              yourName,
              fromName,
              replyTo: userEmail,
            });

            // Update invoice with sent reminder
            const now = new Date();
            const updatedRemindersSent = [
              ...remindersSent,
              { id: template.id, sentAt: now },
            ];

            await db.collection("invoices").updateOne(
              { _id: invoice._id, userId: invoice.userId },
              {
                $set: {
                  remindersSent: updatedRemindersSent,
                  updatedAt: now,
                },
              }
            );

            remindersSentCount++;

            console.log(
              `Sent reminder ${template.id} for invoice ${invoice._id} to ${clientDoc.email}`
            );
          } catch (reminderError) {
            console.error(
              `Failed to send reminder ${template.id} for invoice ${invoice._id}:`,
              reminderError
            );
            // Continue with next reminder
          }
        }
      } catch (invoiceError) {
        console.error(
          `Failed to process invoice ${invoice._id}:`,
          invoiceError
        );
        // Continue with next invoice
      }
    }

    return Response.json({
      ok: true,
      processed: processedCount,
      remindersSent: remindersSentCount,
    });
  } catch (error) {
    console.error("GET /api/cron/reminders error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
