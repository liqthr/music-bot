# Sentry Dashboard Cleanup Guide

## How to Mark the SentryExampleAPIError as Resolved

Since the Sentry example code has been removed from the codebase, you should clean up the historical error records in your Sentry dashboard.

### Steps to Resolve the Issue in Sentry:

1. **Log into your Sentry Dashboard**
   - Go to https://sentry.io
   - Navigate to your `javascript-nextjs-tx` project

2. **Find the Issue**
   - Look for issue ID: `JAVASCRIPT-NEXTJS-TX-1`
   - Or search for: `SentryExampleAPIError`
   - Or filter by URL: `GET /api/sentry-example-api`

3. **Resolve the Issue**
   - Open the issue details page
   - Click the "Resolve" button (usually in the top right)
   - Select resolution type:
     - **Option 1:** "Resolved" - marks it as fixed
     - **Option 2:** "Resolved in next release" - if you track releases
     - **Option 3:** "Ignored" - if you want to hide it permanently

4. **Add a Comment (Optional but Recommended)**
   - Add a comment explaining: "This was a test error from Sentry's Next.js setup wizard. The example code has been removed from the codebase."
   - This helps future developers understand why it was resolved

5. **Archive Old Events (Optional)**
   - If you have many test events, consider using Sentry's "Delete & Discard" feature
   - Go to Project Settings → Inbound Filters
   - You can set up filters to automatically discard events matching certain patterns

### Quick Verification Checklist

After cleanup, verify:
- ✅ Issue `JAVASCRIPT-NEXTJS-TX-1` is marked as "Resolved"
- ✅ No new errors from `/api/sentry-example-api` appear (they shouldn't since the route is gone)
- ✅ Your issue dashboard is clean and only shows real application errors

### Alternative: Bulk Cleanup

If you have multiple Sentry example issues:

1. **Use Sentry's Search**
   - Search for: `url:*/sentry-example*`
   - Select all matching issues
   - Bulk action → Resolve all

2. **Set up Custom Filters**
   - Project Settings → Inbound Filters
   - Add filter for error messages containing "sentry-example"
   - Set action to "Discard and don't track"

---

**Note:** Since all 23 error occurrences happened on `localhost:3000` during development, you may also want to set up environment filters in Sentry to separate development errors from production errors.