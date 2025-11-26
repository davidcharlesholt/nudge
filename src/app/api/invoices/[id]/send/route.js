import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";
import { initializeTemplatesForSchedule } from "@/lib/invoice-templates";

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

    // Check if already sent
    if (invoice.status === "sent") {
      return Response.json(
        { ok: false, error: "Invoice has already been sent" },
        { status: 400 }
      );
    }

    // Validate invoice has all required fields to be sent
    if (!invoice.amountCents || !invoice.dueDate || !invoice.paymentLink) {
      return Response.json(
        {
          ok: false,
          error:
            "Invoice is missing required fields (amount, dueDate, or paymentLink). Please edit the invoice first.",
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

    // Fetch workspace for sender names and default settings
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
      console.log("INVOICE EMAIL → userEmail from currentUser:", userEmail);
    } catch (clerkError) {
      console.warn("Could not fetch user email via currentUser:", clerkError);
    }

    // Get initial template - create default templates if missing
    let templates = invoice.templates || [];
    let initialTemplate = templates.find((t) => t.id === "initial");

    if (!initialTemplate) {
      // Auto-create default templates if missing
      console.log(`Invoice ${id} missing templates, creating defaults...`);

      const defaultTone = workspace?.defaultEmailTone || "friendly";
      const defaultSchedule = invoice.reminderSchedule || "standard";

      // Initialize default templates
      templates = initializeTemplatesForSchedule(defaultSchedule, defaultTone);
      initialTemplate = templates.find((t) => t.id === "initial");

      // Save templates to the invoice for future use
      await db.collection("invoices").updateOne(
        { _id: new ObjectId(id), userId },
        {
          $set: {
            templates,
            reminderSchedule: defaultSchedule,
            emailFlow: "custom",
            updatedAt: new Date(),
          },
        }
      );

      console.log(
        `Created ${templates.length} default templates for invoice ${id}`
      );
    }

    if (!initialTemplate) {
      // This should never happen, but log details if it does
      console.error(`Failed to create initial template for invoice ${id}`, {
        invoiceId: id,
        userId,
        templateCount: templates.length,
        reminderSchedule: invoice.reminderSchedule,
      });

      return Response.json(
        {
          ok: false,
          error:
            "Unable to create invoice email template. Please try editing the invoice and saving it, then try sending again.",
        },
        { status: 500 }
      );
    }

    // Send the email
    try {
      await sendInvoiceEmail({
        to: clientDoc.email,
        ccEmails: invoice.ccEmails || [],
        subject: initialTemplate.subject,
        body: initialTemplate.body,
        client: {
          firstName: clientDoc.firstName,
          fullName: clientDoc.fullName,
        },
        amountCents: invoice.amountCents,
        dueDate: invoice.dueDate,
        paymentLink: invoice.paymentLink,
        yourName,
        fromName,
        replyTo: userEmail, // Clients can reply directly to the user
      });
    } catch (emailError) {
      console.error(
        `Error sending invoice email for invoice ${id}:`,
        emailError.name,
        emailError.message
      );

      // Update the invoice with the email error details
      const errorNow = new Date();
      await db.collection("invoices").updateOne(
        { _id: new ObjectId(id), userId },
        {
          $set: {
            lastEmailErrorMessage:
              emailError.message || "Unknown email send error",
            lastEmailErrorAt: errorNow,
            lastEmailErrorContext: "manual-send",
            updatedAt: errorNow,
          },
        }
      );

      // Return error - do NOT update status to "sent" if email failed
      return Response.json(
        {
          ok: false,
          error:
            "Could not send the email. The invoice remains unsent. Please try again or check the email configuration.",
          emailError: emailError.message,
        },
        { status: 500 }
      );
    }

    // Update invoice status to "sent" and set sentAt timestamp
    // Also clear any previous email errors
    const now = new Date();
    await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          status: "sent",
          sentAt: now,
          updatedAt: now,
          lastEmailErrorMessage: null,
          lastEmailErrorAt: null,
          lastEmailErrorContext: null,
        },
      }
    );

    return Response.json({
      ok: true,
      invoice: {
        ...invoice,
        status: "sent",
        sentAt: now,
        updatedAt: now,
        lastEmailErrorMessage: null,
        lastEmailErrorAt: null,
        lastEmailErrorContext: null,
      },
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/send error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
