/**
 * Backfill script to add default email templates to invoices that are missing them
 * 
 * This script:
 * 1. Finds all invoices that don't have templates or have empty templates array
 * 2. Creates default templates based on the invoice's reminderSchedule and workspace defaultEmailTone
 * 3. Updates the invoices with the default templates
 * 
 * Usage:
 *   node scripts/backfill-invoice-templates.mjs
 * 
 * Or to run in dry-run mode (no changes):
 *   node scripts/backfill-invoice-templates.mjs --dry-run
 */

import { MongoClient } from "mongodb";
import { initializeTemplatesForSchedule } from "../src/lib/invoice-templates.js";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "nudge";

async function backfillInvoiceTemplates(dryRun = false) {
  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI environment variable is not set");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB);
    const invoicesCollection = db.collection("invoices");
    const workspacesCollection = db.collection("workspaces");

    // Find all invoices that don't have templates or have empty templates
    const invoicesWithoutTemplates = await invoicesCollection
      .find({
        $or: [
          { templates: { $exists: false } },
          { templates: null },
          { templates: { $size: 0 } },
        ],
      })
      .toArray();

    console.log(
      `Found ${invoicesWithoutTemplates.length} invoices missing templates`
    );

    if (invoicesWithoutTemplates.length === 0) {
      console.log("No invoices need backfilling. All done!");
      return;
    }

    // Group invoices by userId to fetch workspaces efficiently
    const userIds = [...new Set(invoicesWithoutTemplates.map((inv) => inv.userId))];
    console.log(`Found ${userIds.length} unique users`);

    // Fetch all relevant workspaces
    const workspaces = await workspacesCollection
      .find({ userId: { $in: userIds } })
      .toArray();

    const workspacesByUserId = {};
    workspaces.forEach((ws) => {
      workspacesByUserId[ws.userId] = ws;
    });

    let updatedCount = 0;
    let errorCount = 0;

    // Process each invoice
    for (const invoice of invoicesWithoutTemplates) {
      try {
        const workspace = workspacesByUserId[invoice.userId];
        const defaultTone = workspace?.defaultEmailTone || "friendly";
        const defaultSchedule = invoice.reminderSchedule || "standard";

        // Initialize default templates
        const templates = initializeTemplatesForSchedule(
          defaultSchedule,
          defaultTone
        );

        console.log(
          `  Invoice ${invoice._id}: Creating ${templates.length} templates (schedule: ${defaultSchedule}, tone: ${defaultTone})`
        );

        if (!dryRun) {
          // Update the invoice with default templates
          await invoicesCollection.updateOne(
            { _id: invoice._id },
            {
              $set: {
                templates,
                reminderSchedule: defaultSchedule,
                emailFlow: invoice.emailFlow || "custom",
                updatedAt: new Date(),
              },
            }
          );
          updatedCount++;
        } else {
          console.log(
            `  [DRY RUN] Would update invoice ${invoice._id} with ${templates.length} templates`
          );
          updatedCount++;
        }
      } catch (error) {
        console.error(`  Error processing invoice ${invoice._id}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n=== Backfill Complete ===");
    console.log(`Total invoices processed: ${invoicesWithoutTemplates.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (dryRun) {
      console.log("\n[DRY RUN MODE] No changes were made to the database");
    }
  } catch (error) {
    console.error("Backfill error:", error);
    throw error;
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

if (dryRun) {
  console.log("Running in DRY RUN mode (no changes will be made)");
  console.log("Remove --dry-run flag to actually update invoices\n");
}

// Run the backfill
backfillInvoiceTemplates(dryRun)
  .then(() => {
    console.log("Backfill completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });

