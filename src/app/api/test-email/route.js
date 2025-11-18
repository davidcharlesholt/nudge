import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const result = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || "Nudge"} <${
        process.env.RESEND_FROM_EMAIL
      }>`,
      // 👇 change this to your own email address for the test
      to: ["davidcharlesholt@gmail.com"],
      subject: "Test email from Nudge",
      html: `
        <h1>Nudge + Resend test</h1>
        <p>If you're seeing this, email sending is working 🎉</p>
      `,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Resend test error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to send test email" },
      { status: 500 }
    );
  }
}
