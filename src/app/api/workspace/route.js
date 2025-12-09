import clientPromise from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { getSafeErrorMessage } from "@/lib/utils";

export async function GET() {
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    
    const workspace = await db.collection("workspaces").findOne({ userId });

    if (!workspace) {
      return Response.json({ ok: true, workspace: null });
    }

    // Normalize old "firm-but-polite" value to "firm" for backwards compatibility
    if (workspace.defaultEmailTone === "firm-but-polite") {
      workspace.defaultEmailTone = "firm";
    }

    return Response.json({
      ok: true,
      workspace: {
        ...workspace,
        _id: workspace._id.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/workspace error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to fetch workspace") }, { status: 500 });
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

    const body = await req.json();
    const {
      workspaceName,
      displayName,
      defaultDueDateTerms,
      defaultEmailTone,
    } = body;

    // Validate required fields
    if (!workspaceName || !displayName) {
      return Response.json(
        { ok: false, error: "Workspace name and display name are required." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const now = new Date();
    const workspaceDoc = {
      userId,
      workspaceName: workspaceName.trim(),
      displayName: displayName.trim(),
      defaultDueDateTerms: defaultDueDateTerms || "net-30",
      defaultEmailTone: defaultEmailTone || "friendly",
      autoRemindersEnabled: true, // Always enabled by default
      createdAt: now,
      updatedAt: now,
    };

    // Upsert workspace (update if exists, insert if not)
    const result = await db.collection("workspaces").updateOne(
      { userId },
      { $set: workspaceDoc },
      { upsert: true }
    );

    return Response.json(
      {
        ok: true,
        workspace: workspaceDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/workspace error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to create workspace") }, { status: 500 });
  }
}

export async function PUT(req) {
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

    const body = await req.json();
    let {
      companyName,
      displayName,
      defaultDueDateTerms,
      defaultEmailTone,
    } = body;

    // Normalize old "firm-but-polite" value to "firm" for backwards compatibility
    if (defaultEmailTone === "firm-but-polite") {
      defaultEmailTone = "firm";
    }

    // Validate at least one field is provided
    if (!companyName && !displayName && !defaultDueDateTerms && !defaultEmailTone) {
      return Response.json(
        { ok: false, error: "At least one field must be provided for update." },
        { status: 400 }
      );
    }

    // Validate companyName if provided
    if (companyName !== undefined && !companyName.trim()) {
      return Response.json(
        { ok: false, error: "Company name cannot be empty." },
        { status: 400 }
      );
    }

    // Validate defaultDueDateTerms if provided
    const validTerms = ["due-on-receipt", "net-7", "net-15", "net-30"];
    if (defaultDueDateTerms && !validTerms.includes(defaultDueDateTerms)) {
      return Response.json(
        { ok: false, error: "Invalid due date terms." },
        { status: 400 }
      );
    }

    // Validate defaultEmailTone if provided
    const validTones = ["friendly", "professional", "firm"];
    if (defaultEmailTone && !validTones.includes(defaultEmailTone)) {
      return Response.json(
        { ok: false, error: "Invalid email tone." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Build update object with only provided fields
    const updateFields = {
      updatedAt: new Date(),
    };

    if (companyName !== undefined) {
      updateFields.companyName = companyName.trim();
      // Also update workspaceName for backward compatibility
      updateFields.workspaceName = companyName.trim();
    }

    if (displayName !== undefined) {
      updateFields.displayName = displayName.trim();
    }

    if (defaultDueDateTerms) {
      updateFields.defaultDueDateTerms = defaultDueDateTerms;
    }

    if (defaultEmailTone) {
      updateFields.defaultEmailTone = defaultEmailTone;
    }

    // Update workspace
    await db.collection("workspaces").updateOne(
      { userId },
      { $set: updateFields },
      { upsert: true }
    );

    // Fetch updated workspace
    const updatedWorkspace = await db.collection("workspaces").findOne({ userId });

    return Response.json({
      ok: true,
      workspace: {
        ...updatedWorkspace,
        _id: updatedWorkspace._id.toString(),
      },
    });
  } catch (error) {
    console.error("PUT /api/workspace error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to update workspace") }, { status: 500 });
  }
}

