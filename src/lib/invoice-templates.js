import { EMAIL_TEMPLATES, getTemplateDefaults } from "@/config/emailTemplates";

// Reminder schedule definitions (relative to due date)
export const REMINDER_SCHEDULES = {
  light: {
    name: "Light touch (2 reminders)",
    description: "Gentle approach with minimal follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice: Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1: Sent 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2: Sent on due date", offset: 0 },
    ],
  },
  standard: {
    name: "Standard (3 reminders)",
    description: "Balanced approach with regular follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice: Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1: Sent 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2: Sent 3 days before due date", offset: -3 },
      { id: "reminder3", label: "Reminder 3: Sent on due date", offset: 0 },
    ],
  },
  persistent: {
    name: "Persistent (4 reminders)",
    description: "Proactive approach with consistent follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice: Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1: Sent 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2: Sent 3 days before due date", offset: -3 },
      { id: "reminder3", label: "Reminder 3: Sent on due date", offset: 0 },
      { id: "reminder4", label: "Reminder 4: Sent 7 days after due date", offset: 7 },
    ],
  },
};

// Tone options (updated to match new template structure)
export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "firm", label: "Firm-but-polite" },
];

// Re-export the templates and getter for convenience
export { EMAIL_TEMPLATES, getTemplateDefaults };

/**
 * Initialize templates for a schedule with all tone variants
 * @param {string} schedule - The schedule key (light, standard, persistent)
 * @param {string} defaultTone - The default tone to use for canonical fields (default: "friendly")
 * @returns {Array} Array of template objects with tone variants
 * 
 * Template structure:
 * {
 *   id: "initial" | "reminder1" | "reminder2" | "reminder3" | "reminder4",
 *   label: "Human-readable label",
 *   offset: number | null (days relative to due date),
 *   toneVariants: {
 *     friendly: { subject, body, isCustomized, isDirty },
 *     professional: { subject, body, isCustomized, isDirty },
 *     firm: { subject, body, isCustomized, isDirty }
 *   },
 *   subject: string (canonical - reflects default/current tone),
 *   body: string (canonical - reflects default/current tone),
 *   tone: string (the tone these canonical fields represent)
 * }
 */
export function initializeTemplatesForSchedule(schedule = "standard", defaultTone = "friendly") {
  const scheduleConfig = REMINDER_SCHEDULES[schedule];
  if (!scheduleConfig) {
    console.warn(`Unknown schedule: ${schedule}, falling back to standard`);
    return initializeTemplatesForSchedule("standard", defaultTone);
  }

  return scheduleConfig.templates.map((template) => {
    // Initialize all tone variants
    const toneVariants = {};
    TONE_OPTIONS.forEach((toneOption) => {
      const defaults = getTemplateDefaults(template.id, toneOption.value);
      toneVariants[toneOption.value] = {
        subject: defaults.subject,
        body: defaults.body,
        isCustomized: false, // Has been explicitly customized by user
        isDirty: false, // Has unsaved changes
      };
    });

    // Set canonical fields from default tone
    const defaultVariant = toneVariants[defaultTone];

    return {
      id: template.id,
      label: template.label,
      offset: template.offset,
      toneVariants, // Store all tone variants
      // Canonical fields (for backwards compatibility and easy access)
      subject: defaultVariant.subject,
      body: defaultVariant.body,
      tone: defaultTone,
    };
  });
}

/**
 * Update a specific tone variant for a template
 * @param {Object} template - The template object
 * @param {string} tone - The tone to update
 * @param {string} subject - The custom subject
 * @param {string} body - The custom body
 * @returns {Object} Updated template object
 */
export function updateToneVariant(template, tone, subject, body) {
  const updated = {
    ...template,
    toneVariants: {
      ...template.toneVariants,
      [tone]: {
        subject,
        body,
        isCustomized: true,
        isDirty: false,
      },
    },
  };

  // Update canonical fields to reflect this tone
  updated.subject = subject;
  updated.body = body;
  updated.tone = tone;

  return updated;
}

/**
 * Revert a specific tone variant to defaults
 * @param {Object} template - The template object
 * @param {string} tone - The tone to revert
 * @returns {Object} Updated template object
 */
export function revertToneVariantToDefaults(template, tone) {
  const defaults = getTemplateDefaults(template.id, tone);
  return {
    ...template,
    toneVariants: {
      ...template.toneVariants,
      [tone]: {
        subject: defaults.subject,
        body: defaults.body,
        isCustomized: false,
        isDirty: false,
      },
    },
  };
}

/**
 * Get subject and body for a specific tone
 * @param {Object} template - The template object
 * @param {string} tone - The tone to get
 * @returns {{subject: string, body: string, isCustomized: boolean, isDirty: boolean}} Tone variant
 */
export function getToneVariant(template, tone) {
  return template.toneVariants?.[tone] || { subject: "", body: "", isCustomized: false, isDirty: false };
}

/**
 * Sync canonical fields (subject, body, tone) with a specific tone variant
 * Useful for preparing templates for preview or database storage
 * @param {Object} template - The template object
 * @param {string} tone - The tone to sync to canonical fields
 * @returns {Object} Template with updated canonical fields
 */
export function syncCanonicalFields(template, tone) {
  const variant = getToneVariant(template, tone);
  return {
    ...template,
    subject: variant.subject,
    body: variant.body,
    tone: tone,
  };
}

/**
 * Normalize templates loaded from database to ensure they have canonical fields
 * Handles migration from old format (no toneVariants) to new format
 * @param {Array} templates - Array of template objects from database
 * @param {string} defaultTone - Default tone to use if template doesn't specify
 * @returns {Array} Normalized templates with canonical fields
 */
export function normalizeTemplates(templates, defaultTone = "friendly") {
  if (!templates || !Array.isArray(templates)) {
    return [];
  }

  return templates.map((template) => {
    // If template already has canonical fields and they're non-empty, use them
    if (template.subject && template.body) {
      return template;
    }

    // If template has toneVariants, sync canonical fields from the specified or default tone
    if (template.toneVariants) {
      const tone = template.tone || defaultTone;
      return syncCanonicalFields(template, tone);
    }

    // Template is in unknown format, return as-is (should not happen)
    console.warn("Template missing both canonical fields and toneVariants:", template.id);
    return template;
  });
}

// Deprecated: Legacy compatibility functions
export function updateTemplateTone(template, newTone) {
  // No-op: tone switching is now handled by getToneVariant
  return template;
}

export function customizeTemplate(template, subject, body) {
  // Backwards compat: update friendly tone
  return updateToneVariant(template, "friendly", subject, body);
}

export function revertTemplateToDefaults(template) {
  // Revert all tones to defaults
  const reverted = { ...template, toneVariants: {} };
  TONE_OPTIONS.forEach((toneOption) => {
    const defaults = getTemplateDefaults(template.id, toneOption.value);
    reverted.toneVariants[toneOption.value] = {
      subject: defaults.subject,
      body: defaults.body,
      isCustomized: false,
      isDirty: false,
    };
  });
  return reverted;
}

/**
 * Rewrite invoice email with AI
 * @param {string} subject - Email subject line
 * @param {string} body - Email body
 * @param {string} tone - Tone (friendly, professional, or firm)
 * @returns {Promise<{subject: string, body: string}>} Rewritten content
 */
export async function rewriteWithAI(subject, body, tone) {
  try {
    const response = await fetch("/api/ai/rewrite-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject, body, tone }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to rewrite content");
    }

    return {
      subject: data.subject,
      body: data.body,
    };
  } catch (error) {
    console.error("AI rewrite error:", error);
    throw error;
  }
}
