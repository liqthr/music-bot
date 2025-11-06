# Pre-Deployment Validation

## Overview

This comprehensive validation script checks for **all possible errors** that could occur when deploying to Vercel via GitHub. It runs automatically before builds and can be run manually.

## Requirements

- **Node.js 18+** and **npm** (required to run the script)
- The script will run automatically on:
  - **Vercel** (during build)
  - **GitHub Actions** (on push/PR)

## Local Testing

If you want to test locally, you need Node.js installed:

```bash
# Install Node.js (if not installed)
# Option 1: Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Option 2: Using package manager
# Ubuntu/Debian:
# sudo apt update && sudo apt install nodejs npm

# Then run validation:
npm run validate
```

**Note**: The script is designed to run in CI/CD environments. If Node.js isn't available locally, it will still work on Vercel and GitHub Actions.

## What Gets Checked

### ✅ TypeScript Compilation
- Full type checking across the codebase
- Catches type mismatches, missing types, and invalid assignments

### ✅ ESLint Validation  
- Code quality and style checks
- Identifies blocking errors vs warnings

### ✅ Next.js Configuration
- Validates config file exists and uses correct format
- Prevents `next.config.ts` (not supported)
- Ensures ES module syntax for `.mjs` files

### ✅ Package.json Structure
- Required fields (name, version, scripts)
- Essential dependencies (next, react, react-dom)
- Build script presence

### ✅ Code Patterns
- **No classes**: Detects `export class` (should use functional patterns)
- **No enums**: Detects `export enum` (should use maps/const objects)
- **Proper imports**: Validates import statements

### ✅ API Routes
- Validates all route handlers have proper exports (`GET`, `POST`)
- Checks for NextRequest/NextResponse imports
- Detects unused imports (e.g., axios)

### ✅ Type Definitions
- Validates ErrorType and ErrorSeverity definitions
- Catches invalid type assignments:
  - `type: 'info'` ❌ (should be `type: 'unknown'` with `severity: 'info'`)
  - `type: 'error'` ❌ (should be `severity: 'error'`)

### ✅ Export Validation
- Ensures critical functions are exported:
  - `errorHandler`, `createErrorHandler`
  - `memoryMonitor`, `createMemoryMonitor`, `formatBytes`
  - `createCacheManager`, `searchResultCache`
  - `audioProcessor`, `createAudioProcessor`

### ✅ Runtime Issues
- Missing imports (e.g., `formatBytes` not imported)
- Invalid ErrorInfo usage
- Naming collisions (e.g., SearchFilters)

### ✅ App Router Structure
- Validates `app/` directory exists
- Checks for `app/layout.tsx` and `app/page.tsx`
- Warns about `pages/` directory conflicts

### ✅ Vercel Configuration
- Validates `vercel.json` if present
- Warns about deprecated `builds` configuration
- Checks for App Router conflicts

### ✅ Environment Variables
- Detects environment variable usage
- Warns about variables that need Vercel configuration

## Usage

### Manual Run (requires Node.js)
```bash
npm run validate
```

### Strict Validation (includes build test)
```bash
npm run validate:strict
```

### Automatic (GitHub Actions)
Runs automatically on:
- Push to `main` or `pre-vercel-break` branches
- Pull requests

### On Vercel
Runs automatically during the build process

## Common Errors Caught

1. **Type Errors**
   - `Type '"info"' is not assignable to type 'ErrorType'`
   - Missing type definitions
   - Invalid type assignments

2. **Import Errors**
   - `Cannot find name 'formatBytes'`
   - Missing imports
   - Unused imports

3. **Configuration Errors**
   - `Configuring Next.js via 'next.config.ts' is not supported`
   - Invalid config syntax

4. **Code Pattern Errors**
   - Classes instead of functions
   - Enums instead of maps
   - Naming collisions

5. **Export Errors**
   - Missing exports
   - Incorrect export syntax

6. **Build Errors**
   - TypeScript compilation failures
   - ESLint blocking errors
   - Missing dependencies

## Exit Codes

- `0`: ✅ All validations passed - Ready for deployment
- `1`: ❌ Validation failed - Fix errors before deploying

## Integration

The script is integrated into:
- **GitHub Actions workflow** (`.github/workflows/validate.yml`)
- **Vercel build process** (runs before `next build`)

This ensures issues are caught early, preventing broken deployments to Vercel.

## Testing Without Node.js Locally

If you don't have Node.js installed locally, you can:
1. Push to GitHub - the workflow will run automatically
2. Deploy to Vercel - validation runs during build
3. Install Node.js locally (see Requirements section above)
