import clientPromise from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

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

    return Response.json({
      ok: true,
      workspace: {
        ...workspace,
        _id: workspace._id.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/workspace error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
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
      businessEmail,
      defaultDueDateTerms,
      defaultEmailTone,
      autoRemindersEnabled,
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
      businessEmail: businessEmail?.trim() || "",
      defaultDueDateTerms: defaultDueDateTerms || "net-30",
      defaultEmailTone: defaultEmailTone || "professional",
      autoRemindersEnabled: autoRemindersEnabled ?? true,
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
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

