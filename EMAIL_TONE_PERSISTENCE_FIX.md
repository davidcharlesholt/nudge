# Email Tone Persistence Fix

## Problem
The email tone setting on invoices wasn't being saved correctly. When a user changed the tone from "Friendly" to "Professional" and saved the invoice, upon reopening the invoice, the tone dropdown would revert back to "Friendly" instead of showing the saved tone.

## Root Cause
1. The `emailTone` field wasn't being saved to the database when creating or updating invoices
2. When loading an existing invoice, the tone wasn't being loaded from the saved data
3. Templates were being normalized with a hardcoded "friendly" tone instead of the saved tone

## Solution

### 1. Frontend - New Invoice Page (`src/app/invoices/new/page.jsx`)

**Save tone with invoice:**
```javascript
// For drafts
if (status === "draft") {
  // ... other fields
  payload.emailTone = editorTone; // NEW
}

// For sent invoices
else {
  // ... other fields
  payload.emailTone = editorTone; // NEW
}
```

### 2. Frontend - Edit Invoice Page (`src/app/invoices/[id]/edit/page.jsx`)

**Load saved tone when opening invoice:**
```javascript
// Load saved tone or use workspace default or fallback to "friendly"
const savedTone = invoice.emailTone || workspaceData.workspace?.defaultEmailTone || "friendly";
setEditorTone(savedTone);

// Use saved tone when normalizing templates
const normalizedTemplates = normalizeTemplates(invoice.templates, savedTone);
```

**Save tone when updating invoice:**
```javascript
// In handleSubmit payload
payload.emailTone = editorTone;
```

### 3. Backend - Create Invoice (`src/app/api/invoices/route.js`)

**Accept and save emailTone field:**
```javascript
// Destructure from request body
const { ..., emailTone } = body;

// Save to document
if (normalizedStatus === "sent") {
  doc.emailTone = emailTone || "friendly";
} else {
  if (emailTone) doc.emailTone = emailTone;
}
```

### 4. Backend - Update Invoice (`src/app/api/invoices/[id]/route.js`)

**Accept and save emailTone field:**
```javascript
// Destructure from request body
const { ..., emailTone } = body;

// Save to update document
if (emailTone) updateDoc.emailTone = emailTone;
```

## How It Works Now

### Creating a New Invoice
1. User selects tone (e.g., "Professional")
2. Creates invoice templates with that tone
3. Saves invoice as draft or sends it
4. `emailTone: "professional"` is saved to database

### Editing an Existing Invoice
1. User opens invoice for editing
2. System loads `invoice.emailTone` from database
3. Sets tone dropdown to saved value (e.g., "Professional")
4. Loads templates normalized with that tone
5. User sees correct tone selected
6. Any changes to tone are saved back to database

### Tone Fallback Chain
When loading an invoice:
1. Use `invoice.emailTone` (if exists)
2. Fall back to `workspace.defaultEmailTone` (if exists)
3. Fall back to `"friendly"` (final default)

## Database Schema Update

Invoices now have an `emailTone` field:
```javascript
{
  _id: ObjectId,
  userId: String,
  clientId: ObjectId,
  // ... other fields
  emailTone: "friendly" | "professional" | "firm",  // NEW
  emailFlow: String,
  reminderSchedule: String,
  templates: Array,
  // ... other fields
}
```

## Testing

### Test Case 1: Save Draft with Professional Tone
1. Create new invoice
2. Change tone to "Professional"
3. Save as draft
4. Close and reopen invoice
5. **Expected:** Tone dropdown shows "Professional" ✅

### Test Case 2: Save Draft with Firm Tone
1. Create new invoice
2. Change tone to "Firm-but-polite"
3. Save as draft
4. Close and reopen invoice
5. **Expected:** Tone dropdown shows "Firm-but-polite" ✅

### Test Case 3: Update Existing Invoice Tone
1. Open existing invoice (any tone)
2. Change tone to different value
3. Save changes
4. Close and reopen invoice
5. **Expected:** Tone dropdown shows new tone ✅

### Test Case 4: Templates Reflect Tone
1. Create invoice with "Professional" tone
2. Save and send
3. Check sent email
4. **Expected:** Email uses professional template content ✅

### Test Case 5: Old Invoices Without emailTone
1. Open old invoice without emailTone field
2. **Expected:** Falls back to workspace default or "friendly" ✅
3. Shows correct tone in dropdown
4. Saving will add emailTone field

## Files Modified

1. **`src/app/invoices/new/page.jsx`**
   - Added `emailTone` to payload for both drafts and sent invoices

2. **`src/app/invoices/[id]/edit/page.jsx`**
   - Load `emailTone` from invoice and set `editorTone` state
   - Use saved tone when normalizing templates
   - Save `emailTone` in update payload

3. **`src/app/api/invoices/route.js`** (POST)
   - Accept `emailTone` from request body
   - Save to database for both drafts and sent invoices

4. **`src/app/api/invoices/[id]/route.js`** (PUT)
   - Accept `emailTone` from request body
   - Save to database in update document

## Backward Compatibility

- ✅ Old invoices without `emailTone` field still work
- ✅ Fall back to workspace default or "friendly"
- ✅ No migration needed
- ✅ Next save will add the field

## Benefits

1. **Persistence**: Tone choice is saved and restored
2. **Consistency**: Templates always reflect the chosen tone
3. **User Experience**: No frustration from losing tone settings
4. **Flexibility**: Each invoice can have its own tone
5. **Backward Compatible**: Existing invoices work fine

## No Breaking Changes

- ✅ UI/UX unchanged
- ✅ API contract extended (new optional field)
- ✅ Existing invoices continue to work
- ✅ No database migration required





