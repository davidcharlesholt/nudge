# Email Flow Save/Load Fix

## Problem
When saving an Email Flow with customized templates, only some templates were being restored correctly when applying the flow to a new invoice. The other templates would revert to defaults.

## Root Cause (Two Issues)

### Issue 1: Templates were being overwritten when saving
When clicking "Save Changes" for one template, the `handleSaveTemplate()` function was calling `syncCanonicalFields()` on ALL other templates, which could overwrite their saved content.

**Fix:** Changed `handleSaveTemplate()` to only update the currently selected template and leave others unchanged.

### Issue 2: Editor tone not syncing to template's saved tone (Main Issue)
Each template can have its own tone (friendly, professional, firm). When you save a template:
- The content is saved to `template.toneVariants[currentTone]`
- The canonical fields (`template.subject`, `template.body`, `template.tone`) are set

When switching templates or applying a flow, the editor was loading content based on the global `editorTone` state, NOT the template's saved tone. This meant:
- If you saved Initial with "professional" tone
- But `editorTone` was "friendly"
- The editor would load Initial's "friendly" variant (defaults), not the "professional" content you saved

**Fix:** Added logic to sync `editorTone` to the template's saved tone when:
1. Switching between templates
2. Applying a saved flow

## Solution Details

### 1. Added `useRef` to track template changes
```javascript
const prevSelectedTemplateIdRef = useRef(selectedTemplateId);
```

### 2. Modified the editor loading `useEffect`
```javascript
useEffect(() => {
  const template = templates.find((t) => t.id === selectedTemplateId);
  if (template) {
    let toneToUse = editorTone;
    
    // If template selection changed, sync to the template's saved tone
    const templateChanged = prevSelectedTemplateIdRef.current !== selectedTemplateId;
    if (templateChanged) {
      prevSelectedTemplateIdRef.current = selectedTemplateId;
      if (template.tone) {
        toneToUse = template.tone;
        setEditorTone(template.tone);
      }
    }
    
    const variant = getToneVariant(template, toneToUse);
    setEditorSubject(variant.subject);
    setEditorBody(variant.body);
  }
}, [selectedTemplateId, editorTone, templates]);
```

### 3. Updated `confirmFlowApply()` to set initial tone
```javascript
function confirmFlowApply() {
  // ... set templates, etc.
  
  // Sync editorTone to the initial template's tone
  const initialTemplate = pendingFlow.templates.find(t => t.id === "initial");
  if (initialTemplate && initialTemplate.tone) {
    setEditorTone(initialTemplate.tone);
  }
}
```

### 4. Updated `handleSaveTemplate()` to not affect other templates
```javascript
function handleSaveTemplate() {
  const updatedTemplates = templates.map((t) => {
    if (t.id === selectedTemplateId) {
      return updateToneVariant(t, editorTone, editorSubject, editorBody);
    }
    // Keep other templates unchanged - each template is independent
    return t;
  });
}
```

## How It Works Now

### Saving a Template
1. User edits content in the editor
2. User clicks "Save Changes"
3. Only the selected template is updated with the current tone's content
4. Other templates remain unchanged

### Saving a Flow
1. User has edited and saved multiple templates (each with potentially different tones)
2. User clicks "Save current flow"
3. ALL templates (with their individual tones, subjects, bodies) are saved to the flow

### Applying a Flow
1. User selects a saved flow
2. ALL templates are restored exactly as they were saved
3. `editorTone` is set to match the initial template's tone
4. When switching between templates, `editorTone` syncs to each template's saved tone

### Switching Templates
1. User selects a different template from the dropdown
2. `editorTone` syncs to that template's saved tone (tone toggle updates)
3. Editor displays the content for that template's saved tone

## Files Modified

1. `/src/app/invoices/new/page.jsx`
   - Added `useRef` import
   - Added `prevSelectedTemplateIdRef` 
   - Modified editor loading `useEffect` to sync tone on template change
   - Modified `confirmFlowApply()` to set initial tone
   - Modified `handleSaveTemplate()` to not affect other templates
   - Added explanatory comments

2. `/src/app/invoices/[id]/edit/page.jsx`
   - Same changes as above

## Testing

To verify the fix works:

1. Create a new invoice
2. Edit Initial template with any tone, click "Save Changes"
3. Switch to Reminder 1, change tone if desired, edit content, click "Save Changes"
4. Switch to Reminder 2, change tone if desired, edit content, click "Save Changes"
5. Switch to Reminder 3, change tone if desired, edit content, click "Save Changes"
6. Click "Save current flow", name it "Test Flow"
7. Create a new invoice
8. Select "Test Flow" from the Email flow dropdown
9. Click "Apply flow"
10. **Verify ALL templates are restored:**
    - Switch to each template and verify the content and tone match what you saved
    - The tone toggle should update as you switch templates

## Key Invariants

- Each template maintains its own tone, subject, body, and toneVariants
- Saving one template NEVER affects other templates
- Applying a flow restores ALL templates exactly as saved
- Switching templates syncs the tone toggle to that template's saved tone
- The editor always displays the content for the template's saved tone (not a different tone variant)
