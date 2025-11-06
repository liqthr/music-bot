#!/usr/bin/env node
/**
 * Pre-deployment validation script
 * Checks for common issues that could cause Vercel deployment failures
 */

const { execSync } = require('child_process')
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')

const results = []

function addResult(result) {
  results.push(result)
  if (result.passed) {
    console.log(`✓ ${result.name}`)
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`  ⚠ ${w}`))
    }
  } else {
    console.error(`✗ ${result.name}`)
    if (result.error) {
      console.error(`  Error: ${result.error}`)
    }
  }
}

/**
 * Check if TypeScript compiles without errors
 */
function checkTypeScript() {
  try {
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' })
    addResult({ name: 'TypeScript compilation', passed: true })
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || error.message
    addResult({
      name: 'TypeScript compilation',
      passed: false,
      error: output.split('\n').slice(0, 10).join('\n'),
    })
  }
}

/**
 * Check if ESLint passes
 */
function checkESLint() {
  try {
    execSync('npm run lint', { stdio: 'pipe' })
    addResult({ name: 'ESLint validation', passed: true })
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || error.message
    const hasErrors = output.includes('Error:') || output.includes('✖')
    addResult({
      name: 'ESLint validation',
      passed: !hasErrors,
      error: hasErrors ? output.split('\n').slice(0, 20).join('\n') : undefined,
      warnings: hasErrors ? undefined : ['ESLint warnings found (non-blocking)'],
    })
  }
}

/**
 * Check Next.js configuration
 */
function checkNextConfig() {
  const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts']
  const found = configFiles.find(file => existsSync(file))

  if (!found) {
    addResult({
      name: 'Next.js configuration',
      passed: false,
      error: 'No next.config.js, next.config.mjs, or next.config.ts found',
    })
    return
  }

  if (found === 'next.config.ts') {
    addResult({
      name: 'Next.js configuration',
      passed: false,
      error: 'next.config.ts is not supported. Use next.config.js or next.config.mjs',
    })
    return
  }

  try {
    const content = readFileSync(found, 'utf-8')
    if (found.endsWith('.mjs') && !content.includes('export default')) {
      addResult({
        name: 'Next.js configuration',
        passed: false,
        error: 'next.config.mjs must use ES module syntax (export default)',
      })
      return
    }

    addResult({ name: 'Next.js configuration', passed: true })
  } catch (error) {
    addResult({
      name: 'Next.js configuration',
      passed: false,
      error: `Failed to read config: ${error.message}`,
    })
  }
}

/**
 * Check package.json for required fields
 */
function checkPackageJson() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))

    const issues = []

    if (!packageJson.name) issues.push('Missing "name" field')
    if (!packageJson.version) issues.push('Missing "version" field')
    if (!packageJson.scripts?.build) issues.push('Missing "build" script')
    if (!packageJson.dependencies?.next) issues.push('Missing "next" dependency')
    if (!packageJson.dependencies?.react) issues.push('Missing "react" dependency')

    if (issues.length > 0) {
      addResult({
        name: 'package.json validation',
        passed: false,
        error: issues.join(', '),
      })
    } else {
      addResult({ name: 'package.json validation', passed: true })
    }
  } catch (error) {
    addResult({
      name: 'package.json validation',
      passed: false,
      error: `Failed to parse package.json: ${error.message}`,
    })
  }
}

/**
 * Check for common import errors and code patterns
 */
function checkImports() {
  const issues = []

  const filesToCheck = [
    'app/page.tsx',
    'components/player.tsx',
    'lib/error-handler.ts',
    'lib/cache-manager.ts',
    'lib/memory-monitor.ts',
    'lib/audio-processor.ts',
  ]

  for (const file of filesToCheck) {
    if (!existsSync(file)) {
      issues.push(`Missing file: ${file}`)
      continue
    }

    try {
      const content = readFileSync(file, 'utf-8')

      // Check for class usage (should be functional)
      if (content.includes('export class ') && !file.includes('node_modules')) {
        issues.push(`${file}: Contains class definition (should use functional patterns)`)
      }

      // Check for enum usage (should use maps)
      if (content.match(/export\s+enum\s+\w+/)) {
        issues.push(`${file}: Contains enum (should use maps instead)`)
      }
    } catch (error) {
      issues.push(`${file}: ${error.message}`)
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'Import and code patterns',
      passed: false,
      error: issues.slice(0, 10).join('; '),
    })
  } else {
    addResult({ name: 'Import and code patterns', passed: true })
  }
}

/**
 * Check API routes for common issues
 */
function checkAPIRoutes() {
  const apiRoutes = [
    'app/api/audio/download/route.ts',
    'app/api/search/spotify/route.ts',
    'app/api/search/soundcloud/route.ts',
    'app/api/search/youtube/route.ts',
    'app/api/soundcloud/stream/route.ts',
    'app/api/lyrics/genius/route.ts',
    'app/api/lyrics/musixmatch/route.ts',
  ]

  const issues = []

  for (const route of apiRoutes) {
    if (!existsSync(route)) {
      issues.push(`Missing API route: ${route}`)
      continue
    }

    try {
      const content = readFileSync(route, 'utf-8')

      // Check for proper exports
      if (!content.includes('export async function GET') && !content.includes('export async function POST')) {
        issues.push(`${route}: Missing GET or POST export`)
      }

      // Check for NextRequest/NextResponse usage
      if (!content.includes('NextRequest') && !content.includes('NextResponse')) {
        issues.push(`${route}: Missing NextRequest or NextResponse imports`)
      }

      // Check for unused axios imports
      if (content.includes("import axios") && !content.includes('axios(')) {
        issues.push(`${route}: Unused axios import`)
      }
    } catch (error) {
      issues.push(`${route}: ${error.message}`)
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'API routes validation',
      passed: false,
      error: issues.slice(0, 10).join('; '),
    })
  } else {
    addResult({ name: 'API routes validation', passed: true })
  }
}

/**
 * Check for TypeScript type errors in critical files
 */
function checkTypeErrors() {
  const criticalFiles = [
    'lib/types.ts',
    'lib/error-handler.ts',
    'lib/cache-manager.ts',
  ]

  const issues = []

  for (const file of criticalFiles) {
    if (!existsSync(file)) {
      issues.push(`Missing critical file: ${file}`)
      continue
    }

    try {
      const content = readFileSync(file, 'utf-8')

      // Check for ErrorInfo type usage
      if (file.includes('error-handler')) {
        if (!content.includes("type ErrorType =") || !content.includes("type ErrorSeverity =")) {
          issues.push(`${file}: Missing ErrorType or ErrorSeverity definitions`)
        }
      }

      // Check for invalid ErrorType values
      if (content.includes("type: 'info'") || content.includes('type: "info"')) {
        issues.push(`${file}: Invalid ErrorType 'info' (should be ErrorSeverity)`)
      }
    } catch (error) {
      issues.push(`${file}: ${error.message}`)
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'Type definitions',
      passed: false,
      error: issues.slice(0, 10).join('; '),
    })
  } else {
    addResult({ name: 'Type definitions', passed: true })
  }
}

/**
 * Check for Vercel-specific issues
 */
function checkVercelConfig() {
  const issues = []
  const warnings = []

  if (existsSync('vercel.json')) {
    try {
      const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf-8'))
      
      if (vercelConfig.builds && Array.isArray(vercelConfig.builds)) {
        warnings.push('vercel.json contains "builds" which is deprecated for Next.js')
      }

      if (vercelConfig.rewrites) {
        const rewrites = vercelConfig.rewrites
        if (Array.isArray(rewrites)) {
          rewrites.forEach((rewrite) => {
            if (rewrite.source?.startsWith('/api/') && rewrite.destination?.includes('server.js')) {
              warnings.push(`Rewrite ${rewrite.source} points to server.js (may conflict with App Router)`)
            }
          })
        }
      }
    } catch (error) {
      issues.push(`Invalid vercel.json: ${error.message}`)
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'Vercel configuration',
      passed: false,
      error: issues.join('; '),
    })
  } else {
    addResult({
      name: 'Vercel configuration',
      passed: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  }
}

/**
 * Check for missing exports
 */
function checkExports() {
  const issues = []

  // Check critical exports
  const exportChecks = [
    { file: 'lib/error-handler.ts', exports: ['errorHandler', 'createErrorHandler'] },
    { file: 'lib/memory-monitor.ts', exports: ['memoryMonitor', 'createMemoryMonitor', 'formatBytes'] },
    { file: 'lib/cache-manager.ts', exports: ['createCacheManager', 'searchResultCache'] },
    { file: 'lib/audio-processor.ts', exports: ['audioProcessor', 'createAudioProcessor'] },
  ]

  for (const check of exportChecks) {
    if (!existsSync(check.file)) {
      issues.push(`Missing file: ${check.file}`)
      continue
    }

    try {
      const content = readFileSync(check.file, 'utf-8')
      for (const exp of check.exports) {
        if (!content.includes('export') || !content.includes(exp)) {
          issues.push(`${check.file}: Missing export '${exp}'`)
        }
      }
    } catch (error) {
      issues.push(`${check.file}: ${error.message}`)
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'Export validation',
      passed: false,
      error: issues.slice(0, 10).join('; '),
    })
  } else {
    addResult({ name: 'Export validation', passed: true })
  }
}

/**
 * Check for runtime errors that could occur
 */
function checkRuntimeIssues() {
  const issues = []
  const warnings = []

  // Check app/page.tsx for common issues
  const pageFile = 'app/page.tsx'
  if (existsSync(pageFile)) {
    const content = readFileSync(pageFile, 'utf-8')

    // Check for formatBytes import
    if (content.includes('formatBytes(')) {
      if (!content.includes('formatBytes') || !content.includes("from '@/lib/memory-monitor'")) {
        issues.push('app/page.tsx: formatBytes used but not imported from memory-monitor')
      }
    }

    // Check for ErrorInfo type usage
    if (content.includes("type: 'info'") || content.includes('type: "info"')) {
      issues.push('app/page.tsx: Invalid ErrorType "info" (should be ErrorSeverity, use type: "unknown")')
    }

    // Check for SearchFilters type collision
    const searchFiltersImports = content.match(/import.*SearchFilters.*from/g) || []
    if (searchFiltersImports.length > 1) {
      const hasComponent = content.includes('SearchFiltersComponent') || content.includes('SearchFilters as')
      const hasType = content.includes('SearchFiltersType') || content.includes('SearchFilters as SearchFiltersType')
      if (!hasComponent || !hasType) {
        issues.push('app/page.tsx: SearchFilters naming collision detected (use SearchFiltersType for type, SearchFiltersComponent for component)')
      }
    }
  }

  // Check components/search-filters.tsx
  const searchFiltersFile = 'components/search-filters.tsx'
  if (existsSync(searchFiltersFile)) {
    const content = readFileSync(searchFiltersFile, 'utf-8')
    if (content.includes('export function SearchFilters(') && !content.includes('SearchFiltersComponent')) {
      issues.push('components/search-filters.tsx: Component should be named SearchFiltersComponent to avoid type collision')
    }
  }

  if (issues.length > 0) {
    addResult({
      name: 'Runtime issues',
      passed: false,
      error: issues.join('; '),
    })
  } else {
    addResult({
      name: 'Runtime issues',
      passed: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  }
}

/**
 * Check for common Next.js App Router issues
 */
function checkAppRouterIssues() {
  const issues = []
  const warnings = []

  // Check app directory structure
  if (!existsSync('app')) {
    issues.push('Missing app directory (required for App Router)')
  } else {
    if (!existsSync('app/layout.tsx')) {
      issues.push('Missing app/layout.tsx (required for App Router)')
    }
    if (!existsSync('app/page.tsx')) {
      issues.push('Missing app/page.tsx (required for App Router)')
    }
  }

  // Check for pages directory (conflict with app)
  if (existsSync('pages')) {
    warnings.push('Both "app" and "pages" directories exist (App Router takes precedence)')
  }

  if (issues.length > 0) {
    addResult({
      name: 'App Router structure',
      passed: false,
      error: issues.join('; '),
    })
  } else {
    addResult({
      name: 'App Router structure',
      passed: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  }
}

/**
 * Check for environment variable usage
 */
function checkEnvironmentVariables() {
  const warnings = []

  // Check if environment variables are used but not documented
  const filesToCheck = [
    'app/api/search/spotify/route.ts',
    'app/api/search/soundcloud/route.ts',
    'app/api/search/youtube/route.ts',
  ]

  for (const file of filesToCheck) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8')
      if (content.includes('process.env.') && !content.includes('process.env.NODE_ENV')) {
        const envMatches = content.match(/process\.env\.(\w+)/g)
        if (envMatches) {
          envMatches.forEach(match => {
            const varName = match.replace('process.env.', '')
            warnings.push(`${file}: Uses ${varName} (ensure it's set in Vercel)`)
          })
        }
      }
    }
  }

  addResult({
    name: 'Environment variables',
    passed: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  })
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 Running pre-deployment validation...\n')

  checkPackageJson()
  checkNextConfig()
  checkAppRouterIssues()
  checkTypeScript()
  checkESLint()
  checkImports()
  checkAPIRoutes()
  checkTypeErrors()
  checkVercelConfig()
  checkExports()
  checkRuntimeIssues()
  checkEnvironmentVariables()

  console.log('\n' + '='.repeat(50))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`\nResults: ${passed}/${total} passed, ${failed} failed`)

  if (failed > 0) {
    console.error('\n❌ Validation failed! Please fix the errors above before deploying.')
    process.exit(1)
  } else {
    console.log('\n✅ All validations passed! Ready for deployment.')
    process.exit(0)
  }
}

main()
