import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";
import { REMINDER_SCHEDULES } from "@/lib/invoice-templates";
import { getSafeErrorMessage } from "@/lib/utils";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(_req, context) {
  try {
    // Get the current user's ID from Clerk
    const { userId } = await auth();

    // Return 401 if no user is authenticated
    if (!userId) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Apply rate limiting for email sending
    const rateLimit = checkRateLimit(userId, RATE_LIMITS.email);
    if (!rateLimit.success) {
      return rateLimitResponse(RATE_LIMITS.email.message, rateLimit.resetTime);
    }

    // Await params in case it's a Promise (Next.js 14/15 compatibility)
    const params = await Promise.resolve(context.params);
    const { id } = params;

    // Validate ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return Response.json(
        { ok: false, error: "Invalid invoice ID" },
        { status: 400 }
      );
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    // Find the invoice
    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!invoice) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Ensure status is "sent" or "overdue"
    if (invoice.status !== "sent" && invoice.status !== "overdue") {
      return Response.json(
        {
          ok: false,
          error:
            "Reminders can only be sent for invoices with status 'sent' or 'overdue'",
        },
        { status: 400 }
      );
    }

    // Get reminder schedule
    const reminderSchedule = invoice.reminderSchedule || "standard";
    const schedule = REMINDER_SCHEDULES[reminderSchedule];

    if (!schedule) {
      return Response.json(
        { ok: false, error: `Invalid reminder schedule: ${reminderSchedule}` },
        { status: 400 }
      );
    }

    // Get reminder templates (excluding initial template with null offset)
    const reminderTemplates = schedule.templates.filter(
      (t) => t.offset !== null
    );

    // Get the index of the next reminder to send
    const remindersSent = invoice.remindersSent || [];
    const nextReminderIndex = remindersSent.length;

    // Check if all reminders have been sent
    if (nextReminderIndex >= reminderTemplates.length) {
      return Response.json(
        {
          ok: false,
          error: "All reminders for this invoice have already been sent",
        },
        { status: 400 }
      );
    }

    // Get the next reminder template ID
    const nextReminderTemplateId = reminderTemplates[nextReminderIndex].id;

    // Find the template in the invoice's templates array
    const invoiceTemplates = invoice.templates || [];
    const reminderTemplate = invoiceTemplates.find(
      (t) => t.id === nextReminderTemplateId
    );

    if (!reminderTemplate) {
      return Response.json(
        {
          ok: false,
          error: `Reminder template '${nextReminderTemplateId}' not found in invoice templates`,
        },
        { status: 400 }
      );
    }

    // Check if this reminder has already been sent (safety check)
    if (remindersSent.includes(nextReminderTemplateId)) {
      return Response.json(
        {
          ok: false,
          error: `Reminder '${nextReminderTemplateId}' has already been sent`,
        },
        { status: 400 }
      );
    }

    // Fetch client data
    const clientDoc = await db.collection("clients").findOne({
      _id: invoice.clientId,
      userId,
    });

    if (!clientDoc) {
      return Response.json(
        { ok: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // Fetch workspace for sender names
    const workspace = await db.collection("workspaces").findOne({ userId });
    const companyName = workspace?.workspaceName || workspace?.companyName;
    const displayName = workspace?.displayName;
    const fromName = companyName || displayName || "Nudge";
    const yourName = displayName || companyName || "Nudge";

    // Get user's email from Clerk for reply-to
    let userEmail = null;
    try {
      const user = await currentUser();
      userEmail = user?.emailAddresses?.find(
        (email) => email.id === user.primaryEmailAddressId
      )?.emailAddress;
    } catch (clerkError) {
      // Silently continue - reply-to is optional
    }

    // Send the reminder email
    try {
      await sendInvoiceEmail({
        to: clientDoc.email,
        ccEmails: invoice.ccEmails || [],
        subject: reminderTemplate.subject,
        body: reminderTemplate.body,
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
    } catch (emailError) {
      console.error("Error sending reminder email");
      return Response.json(
        { ok: false, error: getSafeErrorMessage(emailError, "Failed to send reminder email") },
        { status: 500 }
      );
    }

    // Update invoice: add reminder ID to remindersSent and update updatedAt
    const now = new Date();
    const updatedRemindersSent = [...remindersSent, nextReminderTemplateId];

    await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          remindersSent: updatedRemindersSent,
          updatedAt: now,
        },
      }
    );

    // Return updated invoice
    return Response.json({
      ok: true,
      invoice: {
        ...invoice,
        remindersSent: updatedRemindersSent,
        updatedAt: now,
        id: invoice._id.toString(),
        _id: invoice._id.toString(),
        clientId: invoice.clientId.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/send-reminder error");
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to send reminder") }, { status: 500 });
  }
}
