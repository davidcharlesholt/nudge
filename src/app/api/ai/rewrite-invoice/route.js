import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Extract placeholders from text
 * @param {string} text - Text to extract placeholders from
 * @returns {string[]} Array of unique placeholders found
 */
function extractPlaceholders(text) {
  const placeholderRegex = /\{\{\s*[\w]+\s*\}\}/g;
  const matches = text.match(placeholderRegex) || [];
  // Normalize spacing and return unique values
  return [...new Set(matches.map(p => p.replace(/\s+/g, '')))];
}

/**
 * Validate AI output against original placeholders
 * @param {string} originalSubject - Original subject line
 * @param {string} originalBody - Original body text
 * @param {string} rewrittenSubject - Rewritten subject line
 * @param {string} rewrittenBody - Rewritten body text
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateRewrittenContent(originalSubject, originalBody, rewrittenSubject, rewrittenBody) {
  const errors = [];

  // Check lengths
  if (!rewrittenSubject || rewrittenSubject.length === 0) {
    errors.push("Subject cannot be empty");
  }
  if (rewrittenSubject && rewrittenSubject.length > 200) {
    errors.push("Subject exceeds maximum length of 200 characters");
  }

  if (!rewrittenBody || rewrittenBody.length === 0) {
    errors.push("Body cannot be empty");
  }
  if (rewrittenBody && rewrittenBody.length > 5000) {
    errors.push("Body exceeds maximum length of 5000 characters");
  }

  // Extract placeholders from original content
  const originalPlaceholders = extractPlaceholders(`${originalSubject} ${originalBody}`);
  
  // Extract placeholders from rewritten content
  const rewrittenPlaceholders = extractPlaceholders(`${rewrittenSubject} ${rewrittenBody}`);

  // Check that all original placeholders are present in rewritten content
  const missingPlaceholders = originalPlaceholders.filter(
    (placeholder) => !rewrittenPlaceholders.includes(placeholder)
  );

  if (missingPlaceholders.length > 0) {
    errors.push(
      `Missing placeholders from original content: ${missingPlaceholders.join(", ")}`
    );
  }

  // Check for new placeholders that weren't in the original
  const newPlaceholders = rewrittenPlaceholders.filter(
    (placeholder) => !originalPlaceholders.includes(placeholder)
  );

  if (newPlaceholders.length > 0) {
    errors.push(
      `New placeholders added that weren't in original: ${newPlaceholders.join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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

    // Apply rate limiting (10 requests per minute for AI endpoints)
    const rateLimit = checkRateLimit(userId, RATE_LIMITS.ai);
    if (!rateLimit.success) {
      return rateLimitResponse(RATE_LIMITS.ai.message, rateLimit.resetTime);
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { ok: false, error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    const { subject, body, tone } = await req.json();

    // Validate input
    if (!subject || !body || !tone) {
      return Response.json(
        { ok: false, error: "Missing required fields: subject, body, and tone" },
        { status: 400 }
      );
    }

    if (!["friendly", "professional", "firm"].includes(tone)) {
      return Response.json(
        { ok: false, error: "Invalid tone. Must be friendly, professional, or firm" },
        { status: 400 }
      );
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build system prompt
    const systemPrompt = `You are a professional email copywriter specializing in invoice and payment reminder emails. Your task is to rewrite email content to make it sound natural and human while maintaining the exact same intent and preserving ALL placeholders.

CRITICAL RULES:
1. You MUST preserve ALL placeholders from the original content EXACTLY as written (e.g., {{clientName}}, {{amount}}, {{paymentLink}}, etc.)
   - Do NOT alter, remove, or add any placeholders
   - Keep them in the same format with double curly braces
   - Maintain correct spacing and capitalization

2. Rewrite the content to match the specified tone while keeping it professional and appropriate for invoice/payment communications.

3. Maintain the core message and intent of the original email.

4. Keep the email concise and action-oriented.

5. Your response MUST be valid JSON with this exact structure:
   {
     "subject": "rewritten subject line here",
     "body": "rewritten email body here"
   }

6. Do NOT add markdown formatting, code blocks, or any text outside the JSON structure.`;

    // Build user prompt based on tone
    const toneDescriptions = {
      friendly: "warm, conversational, and approachable while remaining professional",
      professional: "polished, clear, and business-appropriate with a neutral tone",
      firm: "direct, assertive, and serious while still being respectful",
    };

    const userPrompt = `Rewrite this invoice email to be ${toneDescriptions[tone]}:

Original Subject: ${subject}

Original Body:
${body}

Remember to:
- Preserve ALL placeholders ({{...}}) from the original text EXACTLY as they appear
- Do NOT add, remove, or modify any placeholders
- Match the ${tone} tone
- Keep it natural and human
- Return ONLY valid JSON with "subject" and "body" fields`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    // Extract response
    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      return Response.json(
        { ok: false, error: "AI generated an empty response" },
        { status: 500 }
      );
    }

    // Parse JSON response
    let rewrittenContent;
    try {
      rewrittenContent = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return Response.json(
        { ok: false, error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      );
    }

    // Validate structure
    if (!rewrittenContent.subject || !rewrittenContent.body) {
      return Response.json(
        { ok: false, error: "AI response missing subject or body fields" },
        { status: 500 }
      );
    }

    // Validate content (safety net)
    const validation = validateRewrittenContent(
      subject,
      body,
      rewrittenContent.subject,
      rewrittenContent.body
    );

    if (!validation.valid) {
      console.error("AI validation failed:", validation.errors);
      return Response.json(
        {
          ok: false,
          error: `AI rewrite validation failed: ${validation.errors.join("; ")}`,
        },
        { status: 422 }
      );
    }

    // Success!
    return Response.json({
      ok: true,
      subject: rewrittenContent.subject.trim(),
      body: rewrittenContent.body.trim(),
    });
  } catch (error) {
    console.error("POST /api/ai/rewrite-invoice error:", error);
    return Response.json(
      { ok: false, error: "Failed to process AI rewrite: " + error.message },
      { status: 500 }
    );
  }
}

