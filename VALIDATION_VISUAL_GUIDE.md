# Form Validation - Visual Guide

## Before vs After

### BEFORE (Old Behavior)
```
User submits form with 3 empty fields:
❌ Toast: "Please fill in all required fields"
❌ No visual indication which fields are missing
❌ User must guess what's wrong
❌ Only one error shown at a time
```

### AFTER (New Behavior)
```
User submits form with 3 empty fields:
✅ Toast: "Please fill in all required fields: Instance, Database, Comments"
✅ Instance field: RED BORDER + "Please select an instance"
✅ Database field: RED BORDER + "Please select a database"
✅ Comments field: RED BORDER + "Please provide comments"
✅ All errors visible simultaneously
✅ User knows exactly what to fix
```

## Field-by-Field Validation

### Instance Selection
```
Empty State:
┌─────────────────────────────────────┐
│ Instance Name *                     │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│ Select Instance                  ▼  │
└─────────────────────────────────────┘
⚠️ Please select an instance          ← RED TEXT
```

### Database Selection
```
Empty State (with instance selected):
┌─────────────────────────────────────┐
│ Database Name *                     │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│ Select Database Name             ▼  │
└─────────────────────────────────────┘
⚠️ Please select a database           ← RED TEXT
```

### POD Selection
```
Empty State:
┌─────────────────────────────────────┐
│ POD Name *                          │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│ Select POD                       ▼  │
└─────────────────────────────────────┘
⚠️ Please select a POD                ← RED TEXT
```

### Comments Field
```
Empty State:
┌─────────────────────────────────────┐
│ Comments *                          │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│                                     │
│ Describe the purpose...             │
│                                     │
└─────────────────────────────────────┘
⚠️ Please provide comments            ← RED TEXT
```

### Query Field (Query Type)
```
Empty State:
┌─────────────────────────────────────┐
│ Database Query *                    │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│                                     │
│ Enter your SQL or MongoDB query...  │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
⚠️ Please enter a query               ← RED TEXT
```

### Script File Upload (Script Type)
```
Empty State:
┌─────────────────────────────────────┐
│ Upload Script File *                │
├─────────────────────────────────────┤ ← RED BORDER (2px)
│         📤                          │
│  Click to upload or drag and drop   │
│  JavaScript (.js) or Python (.py)   │
│  files only (max 16MB)              │
└─────────────────────────────────────┘
⚠️ Please upload a script file        ← RED TEXT
```

## Interactive Behavior

### Scenario 1: Submit Empty Form
```
1. User clicks "Submit Query" button
2. ALL empty fields turn red simultaneously
3. Toast shows: "Please fill in all required fields: Instance, Database, POD, Comments, Query"
4. User sees exactly what needs to be filled
```

### Scenario 2: Fill Fields One by One
```
1. User selects Instance
   → Instance field: Red border DISAPPEARS immediately
   → Error message DISAPPEARS
   
2. User selects Database
   → Database field: Red border DISAPPEARS immediately
   → Error message DISAPPEARS
   
3. User selects POD
   → POD field: Red border DISAPPEARS immediately
   → Error message DISAPPEARS
   
4. User types in Comments
   → Comments field: Red border DISAPPEARS as they type
   → Error message DISAPPEARS
   
5. User enters Query
   → Query field: Red border DISAPPEARS as they type
   → Error message DISAPPEARS
```

### Scenario 3: Submit with 2 Missing Fields
```
1. User fills: Instance, Database, POD, Comments
2. User forgets: Query
3. User clicks "Submit Query"
4. Only Query field turns red
5. Toast shows: "Please fill in all required fields: Query"
6. Other fields remain normal (no red)
```

## POD Filter Clarification

### BEFORE
```
┌─────────────────────────────────────┐
│ Filter by Pod                       │  ← Ambiguous
├─────────────────────────────────────┤
│ All Managed Pods                 ▼  │
└─────────────────────────────────────┘
```

### AFTER
```
┌─────────────────────────────────────┐
│ Requests for My Pods                │  ← Clear purpose
│ Filter requests submitted to your   │  ← Helpful explanation
│ managed pods                        │
├─────────────────────────────────────┤
│ All Managed Pods                 ▼  │
└─────────────────────────────────────┘
```

## CSS Classes Used

### Error Styling
- Border: `border-red-500 border-2`
- Focus Ring: `focus:ring-red-500`
- Text: `text-sm text-red-600`
- Margin: `mt-1` (for error messages)

### Normal Styling (Unchanged)
- Border: `border-gray-200` or `border-gray-300`
- Focus Ring: `focus:ring-purple-500`
- Text: `text-gray-700`

## Validation Logic Flow

```
┌─────────────────────────────────────┐
│ User clicks Submit                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Clear all previous error states     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Validate ALL fields simultaneously  │
│ - Check instance                    │
│ - Check database                    │
│ - Check POD                         │
│ - Check comments                    │
│ - Check query/file (type-specific)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Collect error messages              │
│ errors = ["Instance", "Database"]   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │             │
        ▼             ▼
   Has Errors?    No Errors
        │             │
        ▼             ▼
┌──────────────┐  ┌──────────────┐
│ Set error    │  │ Submit form  │
│ states       │  │ successfully │
│ Show toast   │  └──────────────┘
│ Return early │
└──────────────┘
```

## User Experience Goals

✅ **Immediate Feedback**: Errors clear as user types/selects
✅ **Complete Information**: All errors shown at once
✅ **Visual Clarity**: Red borders and text are obvious
✅ **Helpful Messages**: Each field has specific error text
✅ **No Surprises**: User knows exactly what's missing
✅ **Efficient**: Fix all issues in one pass, not one at a time

## Accessibility Notes

- Error messages use semantic HTML (`<p>` tags)
- Red color is supplemented with text messages (not color-only)
- Focus states remain visible with red ring
- Screen readers will announce error messages
- Required fields marked with asterisk (*) in label
