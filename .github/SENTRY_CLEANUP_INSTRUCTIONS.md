# Sentry Error Cleanup Instructions

## Resolved Issue: SentryExampleAPIError

This file contains instructions for cleaning up the Sentry dashboard after removing example/test code from the Sentry Next.js integration.

### Background

When Sentry's Next.js integration wizard is first run (`npx @sentry/wizard@latest -i nextjs`), it creates example routes and error handlers to test that Sentry is properly capturing errors. These example files include:
- `app/api/sentry-example-api/route.ts` - intentionally throws test errors
- Example pages that trigger these errors

These examples are useful for initial testing but should be removed from production code.

### Status: ✅ RESOLVED

**The Sentry example code has already been removed from this codebase.** The errors you see in Sentry are historical records from when the test code existed.

### How to Clean Up Sentry Dashboard

Follow these steps to mark the example errors as resolved in your Sentry project:

1. **Access Sentry Dashboard**
   - Navigate to: https://sentry.io
   - Select your project: `javascript-nextjs-tx`

2. **Find the Example Issue**
   - Issue ID: `JAVASCRIPT-NEXTJS-TX-1`
   - Error Type: `SentryExampleAPIError`
   - Route: `GET /api/sentry-example-api`

3. **Resolve the Issue**
   - Click on the issue to view details
   - Click the "Resolve" button (top right)
   - Select one of:
     - **Resolved** - marks it as fixed
     - **Resolved in next release** - if tracking releases
     - **Ignore** - permanently hide from dashboard

4. **Add Documentation (Recommended)**
   - Add a comment: "Test error from Sentry Next.js setup wizard. Example code removed from codebase."
   - This helps future developers understand the resolution

### Optional: Prevent Future Test Errors

To avoid similar test errors showing up in your Sentry dashboard:

1. **Environment Filtering**
   - Go to: Project Settings → General
   - Under "Environments", configure to only track production
   - Or exclude "development" environment

2. **Inbound Filters**
   - Go to: Project Settings → Inbound Filters
   - Add a filter for error messages containing "sentry-example"
   - Action: "Discard and don't track"

3. **Best Practices**
   - Always remove Sentry example code before deploying to production
   - Test Sentry integration in a separate test environment
   - Use environment tags to distinguish dev from production errors

### Verification

After cleanup, confirm:
- [ ] Issue `JAVASCRIPT-NEXTJS-TX-1` shows as "Resolved" in Sentry
- [ ] No new occurrences of `/api/sentry-example-api` errors
- [ ] Dashboard only shows real application errors

### Need Help?

- Sentry Documentation: https://docs.sentry.io/
- Sentry Support: https://sentry.io/support/
- This repository's maintainer: [Contact Info]

---

*Last Updated: 2025*
*Resolved By: Automated code cleanup*