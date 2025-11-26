# Resend Invoice Default Subject Line

## Overview
Added a default subject line specifically for resending invoices to ensure resend emails always have a friendly, professional subject even if the template is missing one.

## Changes Made

### 1. ResendEmailDialog Component (`src/app/invoices/page.jsx`)

**Before:**
```javascript
subject: template.subject || template.toneVariants?.friendly?.subject || "No subject",
```

**After:**
```javascript
subject: template.subject || template.toneVariants?.friendly?.subject || "Friendly reminder about your invoice",
```

**What it does:**
- When mapping templates for the resend modal, uses the new default subject
- Shows "Friendly reminder about your invoice" in the preview if template has no subject
- Applies to all templates in the resend dialog

### 2. Resend API Route (`src/app/api/invoices/[id]/resend/route.js`)

**Before:**
```javascript
const finalSubject = template.subject || variant?.subject || "";
```

**After:**
```javascript
const finalSubject = template.subject || variant?.subject || "Friendly reminder about your invoice";
```

**What it does:**
- Backend uses same default subject for resending emails
- Ensures consistency between preview and actual sent email
- Never sends an email with empty subject

## Behavior

### Initial Invoice Send
- **Subject:** "Your invoice is ready!" (or custom template subject)
- **No change** to initial invoice behavior

### Resend Invoice
- **Subject:** "Friendly reminder about your invoice" (if template has no subject)
- **Or:** Uses template's custom subject if defined
- **Fallback chain:**
  1. Template's canonical `subject` field
  2. Template's `toneVariants.friendly.subject`
  3. **"Friendly reminder about your invoice"** (NEW default)

### User Experience

**When user clicks "Resend invoice":**
1. Opens resend modal
2. Shows template selection with previews
3. **Subject preview** shows "Friendly reminder about your invoice" for templates without custom subjects
4. User can see exactly what will be sent
5. Clicking "Send email" uses the same subject shown in preview

## Why This Default?

**"Friendly reminder about your invoice"** was chosen because:
- ✅ Professional and polite
- ✅ Clear purpose (it's a reminder)
- ✅ Works for any reminder (1st, 2nd, 3rd, etc.)
- ✅ Not aggressive or demanding
- ✅ Generic enough to fit all scenarios
- ✅ Better than "No subject" or empty string

## Testing

### Test Case 1: Template with Custom Subject
1. Create invoice with custom template subject
2. Send invoice
3. Click "Resend invoice"
4. **Expected:** Shows custom subject in preview
5. Send email
6. **Expected:** Email has custom subject

### Test Case 2: Template Missing Subject
1. Create invoice (or use one with missing template subject)
2. Send invoice
3. Click "Resend invoice"
4. **Expected:** Shows "Friendly reminder about your invoice" in preview
5. Send email
6. **Expected:** Email has "Friendly reminder about your invoice" as subject

### Test Case 3: Initial vs Reminder Templates
1. Initial invoice send → subject is "Your invoice is ready!"
2. Resend initial → subject is "Friendly reminder about your invoice" (if no custom subject)
3. Send reminder1 → uses reminder template subject or fallback
4. **Verify:** Initial send not affected, only resends use new default

## Files Modified

1. **`src/app/invoices/page.jsx`**
   - Updated `ResendEmailDialog` component
   - Changed fallback from `"No subject"` to `"Friendly reminder about your invoice"`

2. **`src/app/api/invoices/[id]/resend/route.js`**
   - Updated `finalSubject` fallback
   - Changed from `""` to `"Friendly reminder about your invoice"`

## No Other Changes

- ✅ Initial invoice subject unchanged
- ✅ Template structure unchanged
- ✅ No AI generation needed
- ✅ No new user inputs required
- ✅ Fully backward compatible
- ✅ No linter errors

## Benefits

1. **Professional**: Resend emails always have a proper subject
2. **Consistent**: UI preview matches actual sent email
3. **User-friendly**: Clear, non-aggressive reminder language
4. **Reliable**: No more empty or "No subject" emails
5. **Simple**: No configuration needed, just works

## Future Enhancements

If needed, this default could be:
- Made configurable in workspace settings
- Different per template type (reminder1, reminder2, etc.)
- Customizable per user preference

But for now, the static fallback solves the immediate need.

