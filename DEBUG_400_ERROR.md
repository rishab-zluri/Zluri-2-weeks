# Debug 400 Bad Request Error

## What to Check

The 400 error means validation is failing. To find out exactly what's wrong:

### 1. Check Browser Network Tab

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Submit the form
4. Click on the failed request (`submit`)
5. Go to "Response" tab
6. **Copy the entire response body and share it with me**

It should look something like:
```json
{
  "success": false,
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "comments",
      "message": "Comments are required",
      "code": "too_small"
    }
  ]
}
```

### 2. Check Request Payload

In the same Network tab:
1. Go to "Payload" or "Request" tab
2. **Copy the entire request body and share it**

It should show what data you're sending:
```json
{
  "instanceId": "mongodb-atlas-ships",
  "databaseName": "als_database",
  "submissionType": "query",
  "queryContent": "db.ships.find()",
  "comments": "Test query",
  "podId": "pod-1"
}
```

---

## Common Validation Issues

Based on the validation schema, here are the most likely causes:

### ❌ Empty Comments
```typescript
comments: z.string()
  .transform((c) => c.trim())
  .refine((c) => c.length > 0, 'Comments are required')
```

**Fix:** Make sure comments field is not empty or just whitespace

### ❌ Missing Query Content for Query Type
```typescript
.refine((data) => {
  if (data.submissionType === 'query') {
    return !!data.queryContent && data.queryContent.trim().length > 0;
  }
  return true;
}, {
  message: 'Query content is required for query submissions',
  path: ['queryContent'],
})
```

**Fix:** For `submissionType: 'query'`, you MUST provide `queryContent`

### ❌ Invalid Submission Type
```typescript
submissionType: z.enum(['query', 'script'])
```

**Fix:** Must be exactly `'query'` or `'script'` (lowercase)

### ❌ Missing Required Fields
Required fields:
- `instanceId` (string, min 1 char)
- `databaseName` (string, min 1 char)
- `submissionType` ('query' or 'script')
- `comments` (string, non-empty after trim)
- `podId` (string, min 1 char)
- `queryContent` (required if submissionType is 'query')

---

## Quick Test

Try submitting this exact payload to see if it works:

```json
{
  "instanceId": "mongodb-atlas-ships",
  "databaseName": "als_database",
  "submissionType": "query",
  "queryContent": "db.ships.find().limit(10)",
  "comments": "Testing MongoDB connection",
  "podId": "pod-1"
}
```

If this works, then the issue is with your form data. If it still fails, share the error response!

---

## Frontend Form Check

Check your `QuerySubmissionPage.tsx` to ensure:

1. All required fields are being sent
2. `submissionType` is lowercase ('query' not 'Query')
3. Comments field is not empty
4. Query content is provided for query submissions

---

## Next Steps

**Please share:**
1. The full error response from Network tab
2. The request payload being sent
3. Which form fields you filled in

Then I can pinpoint the exact issue!
