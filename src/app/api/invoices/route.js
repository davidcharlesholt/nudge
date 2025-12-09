import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";
import { isValidUrl, isValidEmail, getSafeErrorMessage } from "@/lib/utils";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(req) {
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

    // Parse filter from query params
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    
    // Build query based on filter
    let query = { userId };
    
    if (filter === "draft") {
      query.status = "draft";
    } else if (filter === "sent") {
      query.status = "sent";
    } else if (filter === "paid") {
      query.status = "paid";
    } else if (filter === "pastdue") {
      // Past due: not paid and due date is before today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];
      
      query.status = { $ne: "paid" };
      query.dueDate = { $lt: todayStr };
    }
    // else filter === "all", no additional filters
    
    const invoices = await db
      .collection("invoices")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id and clientId to strings and add id field for frontend
    // Ensure remindersSent defaults to empty array for back-compat
    const invoicesWithStringIds = invoices.map((inv) => ({
      ...inv,
      id: inv._id.toString(),
      _id: inv._id.toString(),
      clientId: inv.clientId.toString(),
      remindersSent: Array.isArray(inv.remindersSent) ? inv.remindersSent : [],
    }));

    return Response.json({ ok: true, invoices: invoicesWithStringIds });
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to fetch invoices") }, { status: 500 });
  }
}

export async function POST(req) {
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

    // Apply rate limiting for email sending (this route can send invoices)
    const rateLimit = checkRateLimit(userId, RATE_LIMITS.email);
    if (!rateLimit.success) {
      return rateLimitResponse(RATE_LIMITS.email.message, rateLimit.resetTime);
    }

    const body = await req.json();
    const {
      clientId,
      amount,
      dueDate,
      status,
      notes,
      paymentLink,
      ccEmails,
      emailFlow,
      reminderSchedule,
      templates,
      emailTone,
    } = body;

    // Validate status enum first
    if (!status) {
      return Response.json(
        {
          ok: false,
          error: "status is required",
        },
        { status: 400 }
      );
    }

    const normalizedStatus = status.toLowerCase().trim();
    if (normalizedStatus !== "draft" && normalizedStatus !== "sent") {
      return Response.json(
        {
          ok: false,
          error: "status must be either 'draft' or 'sent'",
        },
        { status: 400 }
      );
    }

    // Validate required fields based on status
    // Drafts only require clientId
    // Sent invoices require full validation
    if (!clientId) {
      return Response.json(
        {
          ok: false,
          error: "clientId is required",
        },
        { status: 400 }
      );
    }

    if (normalizedStatus === "sent") {
      // Strict validation for sent invoices
      if (!amount || !dueDate || !paymentLink) {
        return Response.json(
          {
            ok: false,
            error:
              "amount, dueDate, and paymentLink are required to send an invoice",
          },
          { status: 400 }
        );
      }

      // Validate paymentLink is a valid URL
      if (typeof paymentLink !== "string" || paymentLink.trim() === "") {
        return Response.json(
          {
            ok: false,
            error: "paymentLink must be a non-empty string.",
          },
          { status: 400 }
        );
      }

      // Validate paymentLink is a properly formatted URL
      if (!isValidUrl(paymentLink.trim())) {
        return Response.json(
          {
            ok: false,
            error: "paymentLink must be a valid URL (starting with http:// or https://).",
          },
          { status: 400 }
        );
      }

      // Validate templates exist for sent invoices
      if (!templates || !Array.isArray(templates) || templates.length === 0) {
        return Response.json(
          {
            ok: false,
            error: "templates are required to send an invoice",
          },
          { status: 400 }
        );
      }
    }

    // Validate ccEmails if provided
    let validCcEmails = [];
    if (ccEmails && Array.isArray(ccEmails)) {
      for (const ccEmail of ccEmails) {
        if (ccEmail && ccEmail.trim()) {
          const trimmed = ccEmail.trim();
          if (!isValidEmail(trimmed)) {
            return Response.json(
              { ok: false, error: `Invalid CC email address: ${trimmed}` },
              { status: 400 }
            );
          }
          validCcEmails.push(trimmed);
        }
      }
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    const now = new Date();

    // Build document with minimal fields for drafts, full fields for sent invoices
    const doc = {
      userId,
      clientId: new ObjectId(clientId),
      status: normalizedStatus,
      notes: notes?.trim() || "",
      // Email error tracking
      lastEmailErrorMessage: null,
      lastEmailErrorAt: null,
      lastEmailErrorContext: null,
      createdAt: now,
      updatedAt: now,
    };

    // Add full fields for sent invoices (or if provided for drafts)
    if (amount !== undefined && amount !== null && amount !== "") {
      doc.amountCents = Math.round(parseFloat(amount) * 100);
    }

    if (dueDate) {
      doc.dueDate = dueDate.trim();
    }

    if (paymentLink) {
      doc.paymentLink = paymentLink.trim();
    }

    if (validCcEmails.length > 0) {
      doc.ccEmails = validCcEmails;
    }

    // Email configuration - only for sent invoices or if explicitly provided
    if (normalizedStatus === "sent") {
      doc.emailFlow = emailFlow || "custom";
      doc.reminderSchedule = reminderSchedule || "standard";
      doc.templates = templates || [];
      doc.emailTone = emailTone || "friendly";
      doc.remindersSent = Array.isArray(body.remindersSent) ? body.remindersSent : [];
    } else {
      // For drafts, store these if provided but don't require them
      if (emailFlow) doc.emailFlow = emailFlow;
      if (reminderSchedule) doc.reminderSchedule = reminderSchedule;
      if (templates) doc.templates = templates;
      if (emailTone) doc.emailTone = emailTone;
      if (body.remindersSent) {
        doc.remindersSent = Array.isArray(body.remindersSent) ? body.remindersSent : [];
      }
    }

    // Add sentAt timestamp if status is "sent"
    if (normalizedStatus === "sent") {
      doc.sentAt = now;
    }

    const result = await db.collection("invoices").insertOne(doc);

    // If status is "sent", send the invoice email
    if (normalizedStatus === "sent") {
      try {
        // Fetch client data
        const clientDoc = await db.collection("clients").findOne({
          _id: new ObjectId(clientId),
          userId,
        });

        if (!clientDoc) {
          throw new Error("Client not found");
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
          console.log("INVOICE EMAIL → userEmail from currentUser:", userEmail);
        } catch (clerkError) {
          console.warn("Could not fetch user email via currentUser:", clerkError);
        }

        // Get initial template
        const initialTemplate = templates.find((t) => t.id === "initial");
        if (initialTemplate) {
          await sendInvoiceEmail({
            to: clientDoc.email,
            ccEmails: doc.ccEmails,
            subject: initialTemplate.subject,
            body: initialTemplate.body,
            client: {
              firstName: clientDoc.firstName,
              fullName: clientDoc.fullName,
            },
            amountCents: doc.amountCents,
            dueDate: doc.dueDate,
            paymentLink: doc.paymentLink,
            yourName,
            fromName,
            replyTo: userEmail,
          });
        }
      } catch (emailError) {
        console.error(
          `Error sending invoice email for invoice ${result.insertedId}:`,
          emailError.name,
          emailError.message
        );

        // Update the invoice with the email error details
        const errorNow = new Date();
        await db.collection("invoices").updateOne(
          { _id: result.insertedId, userId },
          {
            $set: {
              lastEmailErrorMessage:
                emailError.message || "Unknown email send error",
              lastEmailErrorAt: errorNow,
              lastEmailErrorContext: "initial",
              updatedAt: errorNow,
            },
          }
        );

        // Return success with email error - invoice was created but email failed
        return Response.json(
          {
            ok: true,
            invoice: {
              ...doc,
              id: result.insertedId.toString(),
              _id: result.insertedId.toString(),
              clientId: doc.clientId.toString(),
              lastEmailErrorMessage:
                emailError.message || "Unknown email send error",
              lastEmailErrorAt: errorNow,
              lastEmailErrorContext: "initial",
            },
            emailError: emailError.message,
            warning:
              "Invoice was created but the email could not be sent. You can try resending it later.",
          },
          { status: 201 }
        );
      }
    }

    return Response.json(
      {
        ok: true,
        invoice: {
          ...doc,
          id: result.insertedId.toString(),
          _id: result.insertedId.toString(),
          clientId: doc.clientId.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/invoices error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to create invoice") }, { status: 500 });
  }
}
