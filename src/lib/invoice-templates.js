import { EMAIL_TEMPLATES, getTemplateDefaults } from "@/config/emailTemplates";

// Reminder schedule definitions (relative to due date)
export const REMINDER_SCHEDULES = {
  light: {
    name: "Light touch (2 reminders)",
    description: "Gentle approach with minimal follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice – Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1 – 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2 – On due date", offset: 0 },
    ],
  },
  standard: {
    name: "Standard (3 reminders)",
    description: "Balanced approach with regular follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice – Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1 – 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2 – 3 days before due date", offset: -3 },
      { id: "reminder3", label: "Reminder 3 – On due date", offset: 0 },
    ],
  },
  persistent: {
    name: "Persistent (4 reminders)",
    description: "Proactive approach with consistent follow-ups",
    templates: [
      { id: "initial", label: "Initial invoice – Sent immediately", offset: null },
      { id: "reminder1", label: "Reminder 1 – 7 days before due date", offset: -7 },
      { id: "reminder2", label: "Reminder 2 – 3 days before due date", offset: -3 },
      { id: "reminder3", label: "Reminder 3 – On due date", offset: 0 },
      { id: "reminder4", label: "Reminder 4 – 7 days after due date", offset: 7 },
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
 * Initialize templates for a schedule with default tone
 * @param {string} schedule - The schedule key (light, standard, persistent)
 * @param {string} tone - The tone (friendly, professional, firm)
 * @returns {Array} Array of template objects
 */
export function initializeTemplatesForSchedule(schedule = "standard", tone = "friendly") {
  const scheduleConfig = REMINDER_SCHEDULES[schedule];
  if (!scheduleConfig) {
    console.warn(`Unknown schedule: ${schedule}, falling back to standard`);
    return initializeTemplatesForSchedule("standard", tone);
  }

  return scheduleConfig.templates.map((template) => {
    const defaults = getTemplateDefaults(template.id, tone);
    return {
      id: template.id,
      label: template.label,
      offset: template.offset,
      tone,
      subject: defaults.subject,
      body: defaults.body,
      isDirty: false, // Has unsaved changes
      isCustomized: false, // Has been explicitly customized by user
    };
  });
}

/**
 * Update a template's tone and get new defaults if not customized
 * @param {Object} template - The template object
 * @param {string} newTone - The new tone to apply
 * @returns {Object} Updated template object
 */
export function updateTemplateTone(template, newTone) {
  // If template has been customized, only update the tone field
  if (template.isCustomized) {
    return {
      ...template,
      tone: newTone,
    };
  }

  // If not customized, load new defaults for the new tone
  const defaults = getTemplateDefaults(template.id, newTone);
  return {
    ...template,
    tone: newTone,
    subject: defaults.subject,
    body: defaults.body,
  };
}

/**
 * Mark a template as customized (user has edited it)
 * @param {Object} template - The template object
 * @param {string} subject - The custom subject
 * @param {string} body - The custom body
 * @returns {Object} Updated template object
 */
export function customizeTemplate(template, subject, body) {
  return {
    ...template,
    subject,
    body,
    isCustomized: true,
    isDirty: false,
  };
}

/**
 * Revert a template to its defaults
 * @param {Object} template - The template object
 * @returns {Object} Reverted template object
 */
export function revertTemplateToDefaults(template) {
  const defaults = getTemplateDefaults(template.id, template.tone);
  return {
    ...template,
    subject: defaults.subject,
    body: defaults.body,
    isCustomized: false,
    isDirty: false,
  };
}

// Stub AI rewrite function
export function rewriteWithAI(text, tone) {
  const toneModifiers = {
    friendly: " 😊",
    professional: "",
    firm: " Please note this requires immediate attention.",
  };

  return text.trim() + (toneModifiers[tone] || "") + "\n\n[AI-enhanced draft]";
}
