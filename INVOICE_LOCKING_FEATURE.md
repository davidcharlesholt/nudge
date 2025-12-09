# Invoice Locking & Duplication Feature

## Overview
This feature prevents users from editing critical fields on sent invoices and provides a way to duplicate invoices as new drafts.

## Features Implemented

### 1. Lock Critical Fields on Sent Invoices

**Locked Fields (when status is "sent"):**
- Client
- Amount
- Due Date
- Payment Link

**UI Changes:**
- **Warning Banner**: Shows at the top of the edit page for sent invoices
  - Amber background with warning icon
  - Explains which fields are locked
  - Suggests duplicating to make changes

- **Disabled Inputs**: Locked fields are visually disabled
  - Client dropdown is disabled
  - Amount input is disabled
  - Due date input is disabled
  - Payment link input is disabled

- **Draft invoices** remain fully editable

### 2. Backend Protection

**API Endpoint: `PUT /api/invoices/[id]`**

Added validation to block updates to locked fields:
```javascript
// Check if invoice is already sent
if (existingInvoice.status === "sent") {
  // Compare incoming values with existing values
  // If any locked field has changed, return 400 error
}
```

**Error Response:**
```json
{
  "ok": false,
  "error": "Cannot update amount, dueDate on a sent invoice. These fields are locked once an invoice is sent."
}
```

### 3. Duplicate as Draft Action

**New API Endpoint: `POST /api/invoices/[id]/duplicate`**

**What it does:**
- Creates a new invoice record
- Copies fields from original invoice:
  - clientId
  - amountCents
  - dueDate
  - paymentLink
  - notes
  - ccEmails
  - emailFlow
  - reminderSchedule
  - templates

**What it resets:**
- status: Always "draft"
- sentAt: null
- remindersSent: []
- Email error fields: null
- Timestamps: New createdAt/updatedAt

**UI Integration:**
- Added "Duplicate as Draft" option to invoice dropdown menu
- Shows on both mobile and desktop views
- Copy icon for easy recognition
- Success toast notification
- Automatically redirects to edit page for new draft

## Files Changed

### API Routes

1. **`src/app/api/invoices/[id]/duplicate/route.js`** (NEW)
   - Handles POST request to duplicate invoices
   - Creates new draft with copied data
   - Returns new invoice ID

2. **`src/app/api/invoices/[id]/route.js`** (UPDATED)
   - Added validation to block locked field edits
   - Compares incoming values with existing values
   - Returns clear error messages

### Frontend

3. **`src/app/invoices/[id]/edit/page.jsx`** (UPDATED)
   - Added warning banner for sent invoices
   - Added `disabled` prop to locked fields
   - Banner shows when `status === "sent"`

4. **`src/app/invoices/page.jsx`** (UPDATED)
   - Added `Copy` icon import
   - Added `handleDuplicateAsDraft()` function
   - Added "Duplicate as Draft" menu item (mobile & desktop)
   - Shows toast notifications

## User Flow

### Editing a Sent Invoice

1. User navigates to edit page of sent invoice
2. **Warning banner** appears at top:
   ```
   ⚠️ This invoice has already been sent
   Amount, due date, client, and payment link are locked.
   To make changes, duplicate this invoice as a new draft from the All Invoices page.
   ```
3. Locked fields are **visually disabled** (grayed out)
4. User can still edit:
   - Status
   - Notes
   - CC emails
   - Templates
   - Reminder schedule

### Duplicating an Invoice

1. User goes to **All Invoices** page
2. Clicks three-dot menu (⋮) on any invoice row
3. Selects **"Duplicate as Draft"**
4. System creates new draft invoice
5. **Success toast** appears: "Invoice duplicated - A new draft invoice has been created."
6. User is **redirected** to edit page for the new draft
7. New draft has all the data from original, but status is "draft"
8. User can now edit all fields freely

## Testing Checklist

### Lock Fields on Sent Invoice

- [ ] Send an invoice (status changes to "sent")
- [ ] Go to edit page for that invoice
- [ ] Verify warning banner appears
- [ ] Verify client dropdown is disabled
- [ ] Verify amount input is disabled
- [ ] Verify due date input is disabled
- [ ] Verify payment link input is disabled
- [ ] Verify can still edit notes, status, etc.

### API Protection

- [ ] Try to update amount on sent invoice via API
- [ ] Verify returns 400 error
- [ ] Verify error message lists locked fields
- [ ] Try to update draft invoice
- [ ] Verify update succeeds (drafts not locked)

### Duplicate as Draft

- [ ] Go to All Invoices page
- [ ] Click ⋮ menu on any invoice
- [ ] Click "Duplicate as Draft"
- [ ] Verify success toast appears
- [ ] Verify redirected to edit page
- [ ] Verify URL contains new invoice ID (different from original)
- [ ] Verify all fields copied correctly
- [ ] Verify status is "draft"
- [ ] Verify can edit all fields
- [ ] Verify original invoice unchanged

### Edge Cases

- [ ] Duplicate a draft invoice
- [ ] Duplicate a paid invoice
- [ ] Duplicate an overdue invoice
- [ ] Try to duplicate non-existent invoice (should 404)
- [ ] Try to duplicate someone else's invoice (should 404)

## Error Handling

### Frontend
- Toast notifications for success/failure
- Clear error messages in toasts
- Console logging for debugging

### Backend
- 400 for locked field edit attempts
- 404 for invoice not found
- 401 for unauthorized access
- 500 for server errors
- Detailed error messages in response

## Design Decisions

### Why Lock These Fields?

**Client, Amount, Due Date, Payment Link** are locked because:
1. They're part of the invoice's legal/financial record
2. Changing them after sending creates confusion
3. The sent email already contains these values
4. Better to create new invoice than change history

### Why Not Delete Sent Invoices?

Sent invoices can still be deleted, but editing is locked:
- Deletion is deliberate action with confirmation
- Editing might be accidental
- User can duplicate first, then delete original if needed

### Why Auto-Redirect After Duplicate?

- User's intent is clear: they want to edit
- Saves a click
- Provides immediate feedback that action succeeded
- New draft is ready to edit immediately

## Benefits

1. **Data Integrity**: Sent invoices maintain their original values
2. **Audit Trail**: Original invoice remains unchanged
3. **User Clarity**: Clear warnings about what can/can't be changed
4. **Flexibility**: Easy to create variations via duplication
5. **Safety**: Backend validation prevents accidental changes
6. **UX**: Clear visual feedback and helpful error messages



