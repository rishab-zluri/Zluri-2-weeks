# Processed Requests Fix - MyQueriesPage

## Problem

When a manager rejects a request from the Approval Dashboard, the rejected request was not showing up in the **"Processed Requests"** tab of the Requests page (MyQueriesPage). The issue was that the code was excluding the manager's own requests from the history view.

## Root Cause

In `frontend/src/pages/MyQueriesPage.tsx`, line 141-143:

```typescript
// Exclude manager's own requests in history (Processed Requests) view
if (viewMode === 'history') {
  managerFilters.excludeOwnRequests = 'true';
}
```

This was preventing managers from seeing requests they had processed if they were the ones who submitted them.

## Solution

### 1. Removed the `excludeOwnRequests` Filter

**File**: `frontend/src/pages/MyQueriesPage.tsx`

**Before**:
```typescript
// Exclude manager's own requests in history (Processed Requests) view
if (viewMode === 'history') {
  managerFilters.excludeOwnRequests = 'true';
}
```

**After**:
```typescript
// Note: We DON'T exclude manager's own requests in history
// Managers should see ALL requests they've processed, including their own
```

Now the "Processed Requests" tab shows ALL requests the manager has approved or rejected, regardless of who submitted them.

### 2. Added "Processed By" Column

Added a new column in the Processed Requests tab showing who approved/rejected each request:

**Table Header**:
```typescript
{effectiveViewMode === 'history' && <th className="pb-3 font-medium">Processed By</th>}
```

**Table Cell**:
```typescript
{effectiveViewMode === 'history' && (
  <td className="py-4">
    {query.approver ? (
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">
          {query.approver.email || query.approver.name || 'Unknown'}
        </span>
      </div>
    ) : (
      <span className="text-sm text-gray-400">N/A</span>
    )}
  </td>
)}
```

### 3. Enhanced Detail Modal

Added "Processed By" section in the detail modal:

```typescript
{/* Approver Info (if processed) */}
{selectedQuery.approver && (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
    <label className="text-sm font-medium text-gray-700">Processed By</label>
    <div className="flex items-center gap-2 mt-2">
      <User className="w-4 h-4 text-gray-500" />
      <span className="text-gray-900">
        {selectedQuery.approver.name || selectedQuery.approver.email}
      </span>
      <span className="text-gray-500 text-sm">
        ({selectedQuery.approver.role})
      </span>
    </div>
  </div>
)}
```

Also improved the rejection reason display:

```typescript
{selectedQuery.rejectionReason && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <label className="text-sm font-medium text-red-800 flex items-center gap-2">
      <XCircle className="w-4 h-4" />
      Rejection Reason
    </label>
    <p className="text-red-700 mt-2">{selectedQuery.rejectionReason}</p>
  </div>
)}
```

---

## User Experience

### For Managers

#### My Requests Tab
- See their own submitted requests
- Same as before

#### Processed Requests Tab (FIXED)
- ✅ Now shows ALL requests they've approved or rejected
- ✅ Includes requests they submitted themselves
- ✅ Shows "Processed By" column with manager's email
- ✅ Can filter by status, date, POD, type
- ✅ Can search processed requests

### For Developers

#### My Requests Tab
- See all their submitted requests
- Can see rejection reasons
- Can see who processed their requests
- Same as before

---

## Visual Changes

### Processed Requests Table (Manager View)

**Before** (didn't show manager's own processed requests):
```
| ID | Database | Type | User | Status | Date | Actions |
|----|----------|------|------|--------|------|---------|
| #2 | ships_db | Query| dev@...| Rejected | Jan 19 | View |
```

**After** (shows ALL processed requests + Processed By column):
```
| ID | Database | Type | User | Status | Processed By | Date | Actions |
|----|----------|------|------|--------|--------------|------|---------|
| #1 | portal_db| Query| Me   | Approved | manager@... | Jan 20 | View |
| #2 | ships_db | Query| dev@...| Rejected | manager@... | Jan 19 | View |
```

### Detail Modal (Enhanced)

```
┌─────────────────────────────────────────┐
│ Query Details                           │
├─────────────────────────────────────────┤
│ Status: ❌ Rejected                     │
│ Request ID: #72                         │
│                                         │
│ Database: portal_db                     │
│ POD: Engineering Pod                    │
│                                         │
│ Comments: Data migration script         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ❌ Rejection Reason                 │ │
│ │ Query is too broad, please add      │ │
│ │ WHERE clause to limit results       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Processed By                        │ │
│ │ 👤 manager1@zluri.com (manager)     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Query Content: ...                      │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

### As a Manager

- [ ] Navigate to Requests page (navbar)
- [ ] See two tabs: "My Requests" and "Processed Requests"
- [ ] Submit a request as a manager
- [ ] Go to Approval Dashboard
- [ ] Approve your own request
- [ ] Go back to Requests page
- [ ] Click "Processed Requests" tab
  - [ ] ✅ See your approved request
  - [ ] ✅ "User" column shows "Me"
  - [ ] ✅ "Processed By" column shows your email
- [ ] Reject another developer's request
- [ ] Go to "Processed Requests" tab
  - [ ] ✅ See the rejected request
  - [ ] ✅ "User" column shows developer's email
  - [ ] ✅ "Processed By" column shows your email
- [ ] Click "View" on a rejected request
  - [ ] ✅ See rejection reason in red box
  - [ ] ✅ See "Processed By" section with your info
- [ ] Click "View" on an approved request
  - [ ] ✅ See "Processed By" section with your info

### As a Developer

- [ ] Submit a request
- [ ] Wait for manager to reject it
- [ ] Go to "My Requests" tab
  - [ ] ✅ See the rejected request
  - [ ] Click "View Details"
  - [ ] ✅ See rejection reason in red box
  - [ ] ✅ See "Processed By" section with manager's info

---

## API Endpoints

### Get Processed Requests (Manager)
```
GET /api/v1/queries/pending?status=approved,rejected,completed,failed,executing&page=1&limit=10
```

Returns all processed requests with `approver` and `rejectionReason` fields populated.

---

## Data Flow

### When Manager Rejects a Request

1. Manager clicks "Reject" in Approval Dashboard
2. Provides rejection reason
3. Backend updates request:
   - `status` → `rejected`
   - `rejectionReason` → manager's reason
   - `approver` → manager's user object
4. Frontend refetches data
5. Request now appears in:
   - ✅ Manager's "Processed Requests" tab (MyQueriesPage)
   - ✅ Developer's "My Requests" tab (MyQueriesPage)

### When Manager Approves a Request

1. Manager clicks "Approve" in Approval Dashboard
2. Backend updates request:
   - `status` → `approved` → `executing` → `completed`/`failed`
   - `approver` → manager's user object
3. Frontend refetches data
4. Request now appears in:
   - ✅ Manager's "Processed Requests" tab (MyQueriesPage)
   - ✅ Developer's "My Requests" tab (MyQueriesPage)

---

## Benefits

### For Managers
1. ✅ **Complete Audit Trail** - See ALL requests they've processed
2. ✅ **Self-Service** - Can approve their own requests and see them in history
3. ✅ **Accountability** - Clear record of who processed what
4. ✅ **Transparency** - Easy to track all processed requests

### For Developers
1. ✅ **Feedback** - See why their request was rejected
2. ✅ **Accountability** - Know who processed their request
3. ✅ **Learning** - Understand what makes a good request

### For Organization
1. ✅ **Compliance** - Complete audit trail
2. ✅ **Metrics** - Track approval rates, rejection reasons
3. ✅ **Quality** - Improve request quality over time

---

## Changes Summary

| File | Changes |
|------|---------|
| `frontend/src/pages/MyQueriesPage.tsx` | - Removed `excludeOwnRequests` filter<br>- Added "Processed By" column<br>- Enhanced detail modal with approver info<br>- Improved rejection reason display |

---

## Status

✅ **COMPLETE** - Processed Requests now show ALL requests managers have approved/rejected

## Files Modified

1. `frontend/src/pages/MyQueriesPage.tsx` - Fixed processed requests filtering and added approver info

---

**Last Updated**: January 20, 2026  
**Version**: 1.0
