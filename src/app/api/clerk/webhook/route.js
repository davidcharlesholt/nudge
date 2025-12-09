/**
 * Clerk Webhook Handler
 * 
 * This endpoint is triggered by Clerk when users perform actions in the Clerk
 * Account Portal, such as deleting their account via the "Delete account" button.
 * 
 * When a user.deleted event is received, this handler cleans up all associated
 * data in our MongoDB database:
 * - Workspace settings
 * - Clients
 * - Invoices
 * - Email flows
 * 
 * This is the ONLY way to delete an account - there is no in-app delete option.
 * Users must use Clerk's Account Portal to delete their account.
 * 
 * Required environment variable:
 * - CLERK_WEBHOOK_SECRET: The webhook signing secret from Clerk Dashboard
 */

import { Webhook } from "svix";
import { headers } from "next/headers";
import clientPromise from "@/lib/db";

export async function POST(req) {
  // Get the webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return Response.json(
      { ok: false, error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get the headers for signature verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no Svix headers, this request didn't come from Clerk
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return Response.json(
      { ok: false, error: "Missing webhook signature headers" },
      { status: 400 }
    );
  }

  // Get the body as text for signature verification
  const payload = await req.text();

  // Create a new Svix instance with the webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt;

  // Verify the webhook signature
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Webhook signature verification failed");
    return Response.json(
      { ok: false, error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  // Handle the webhook event
  const eventType = evt.type;

  if (eventType === "user.deleted") {
    // Extract the user ID from the webhook payload
    const { id: userId } = evt.data;

    if (!userId) {
      console.error("user.deleted event missing user ID");
      return Response.json(
        { ok: false, error: "Missing user ID in webhook payload" },
        { status: 400 }
      );
    }

    // Processing user.deleted webhook

    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || "nudge");

      // Delete all user data in parallel
      // This is idempotent - if documents are already gone, deleteMany/deleteOne
      // will simply return deletedCount: 0 without throwing
      const deleteResults = await Promise.allSettled([
        db.collection("workspaces").deleteOne({ userId }),
        db.collection("clients").deleteMany({ userId }),
        db.collection("invoices").deleteMany({ userId }),
        db.collection("email_flows").deleteMany({ userId }),
      ]);

      // Check for any failures
      const hasFailure = deleteResults.some(r => r.status === "rejected");
      if (hasFailure) {
        console.error("Some collections failed to delete during user cleanup");
      }
      return Response.json({ ok: true });
    } catch (error) {
      console.error("Error processing user.deleted webhook");
      return Response.json(
        { ok: false, error: "Failed to delete user data" },
        { status: 500 }
      );
    }
  }

  // For other event types, just acknowledge receipt
  return Response.json({ ok: true, received: true });
}



