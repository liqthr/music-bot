/**
 * Search query parser
 * Parses advanced search queries with boolean operators, quoted phrases, and field-specific searches
 */

/**
 * Query token types
 */
export type TokenType = 'TERM' | 'QUOTED' | 'FIELD' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN'

/**
 * Query token
 */
export interface QueryToken {
  type: TokenType
  value: string
  field?: string // For FIELD tokens
  start: number
  end: number
}

/**
 * Field-specific search
 */
export interface FieldSearch {
  field: 'artist' | 'album' | 'year' | 'duration'
  value: string
  operator?: '=' | '>' | '<' | '>=' | '<='
}

/**
 * Parsed query structure
 */
export interface ParsedQuery {
  tokens: QueryToken[]
  hasOperators: boolean
  hasFields: boolean
  hasQuotes: boolean
  hasGrouping: boolean
  fields: FieldSearch[]
  errors: string[]
}

/**
 * Parse search query into tokens
 * @param query - Search query string
 * @returns Parsed query structure
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const tokens: QueryToken[] = []
  const errors: string[] = []
  let pos = 0
  const len = query.length

  // Track parentheses and quotes for validation
  let parenDepth = 0
  let inQuotes = false
  let quoteStart = -1

  // Skip whitespace
  const skipWhitespace = () => {
    while (pos < len && /\s/.test(query[pos])) {
      pos++
    }
  }

  // Check if at end
  const isAtEnd = () => pos >= len

  // Parse quoted phrase
  const parseQuoted = (): QueryToken | null => {
    if (query[pos] !== '"') return null

    const start = pos
    pos++ // Skip opening quote
    inQuotes = true
    quoteStart = start

    let value = ''
    while (pos < len && query[pos] !== '"') {
      if (query[pos] === '\\' && pos + 1 < len) {
        // Handle escaped characters
        pos++
        value += query[pos]
      } else {
        value += query[pos]
      }
      pos++
    }

    if (pos >= len) {
      errors.push('Unmatched quote')
      // Don't set inQuotes = false here - preserve state for validation
      return null
    }

    pos++ // Skip closing quote
    inQuotes = false

    return {
      type: 'QUOTED',
      value: value.trim(),
      start,
      end: pos,
    }
  }

  // Parse field-specific search (field:value)
  const parseField = (): QueryToken | null => {
    const fieldMatch = /^(\w+):/.exec(query.substring(pos))
    if (!fieldMatch) return null

    const fieldName = fieldMatch[1].toLowerCase()
    const validFields = ['artist', 'album', 'year', 'duration']

    if (!validFields.includes(fieldName)) {
      // Not a valid field, treat as regular term
      return null
    }

    const start = pos
    pos += fieldMatch[0].length // Skip "field:"

    // Parse field value (can be quoted or unquoted)
    let value = ''
    let operator: string | undefined

    // Check for operators for duration and year fields
    if (fieldName === 'duration' || fieldName === 'year') {
      const opMatch = /^([><=]+)\s*/.exec(query.substring(pos))
      if (opMatch) {
        operator = opMatch[1]
        pos += opMatch[0].length
      }
    }

    // Parse value (quoted or unquoted)
    if (pos < len && query[pos] === '"') {
      const quoted = parseQuoted()
      if (quoted) {
        value = quoted.value
        return {
          type: 'FIELD',
          value: operator ? `${operator}${value}` : value,
          field: fieldName as FieldSearch['field'],
          start,
          end: quoted.end,
        }
      }
    } else {
      // Parse unquoted value
      const valueStart = pos
      while (pos < len && !/\s/.test(query[pos]) && query[pos] !== ')' && query[pos] !== '(') {
        value += query[pos]
        pos++
      }
      value = value.trim()
      if (operator) {
        value = `${operator}${value}`
      }
    }

    if (!value) {
      errors.push(`Empty value for field: ${fieldName}`)
      return null
    }

    return {
      type: 'FIELD',
      value,
      field: fieldName as FieldSearch['field'],
      start,
      end: pos,
    }
  }

  // Parse operator
  const parseOperator = (): QueryToken | null => {
    skipWhitespace()
    if (isAtEnd()) return null

    const remaining = query.substring(pos).toUpperCase()
    if (remaining.startsWith('AND ')) {
      const start = pos
      pos += 4
      return { type: 'AND', value: 'AND', start, end: pos }
    }
    if (remaining.startsWith('OR ')) {
      const start = pos
      pos += 3
      return { type: 'OR', value: 'OR', start, end: pos }
    }
    if (remaining.startsWith('NOT ')) {
      const start = pos
      pos += 4
      return { type: 'NOT', value: 'NOT', start, end: pos }
    }

    return null
  }

  // Parse term (word or phrase)
  const parseTerm = (): QueryToken | null => {
    skipWhitespace()
    if (isAtEnd()) return null

    // Check for parentheses
    if (query[pos] === '(') {
      const start = pos
      pos++
      parenDepth++
      return { type: 'LPAREN', value: '(', start, end: pos }
    }
    if (query[pos] === ')') {
      const start = pos
      pos++
      parenDepth--
      if (parenDepth < 0) {
        errors.push('Unmatched closing parenthesis')
        parenDepth = 0
      }
      return { type: 'RPAREN', value: ')', start, end: pos }
    }

    // Check for quoted phrase
    if (query[pos] === '"') {
      return parseQuoted()
    }

    // Check for field
    const field = parseField()
    if (field) return field

    // Parse regular term
    const start = pos
    let value = ''
    while (pos < len && !/\s/.test(query[pos]) && query[pos] !== '(' && query[pos] !== ')') {
      value += query[pos]
      pos++
    }

    if (value) {
      return { type: 'TERM', value: value.trim(), start, end: pos }
    }

    return null
  }

  // Main parsing loop
  skipWhitespace()
  while (!isAtEnd()) {
    // Try to parse operator first
    const op = parseOperator()
    if (op) {
      tokens.push(op)
      skipWhitespace()
      continue
    }

    // Parse term or grouping
    const token = parseTerm()
    if (token) {
      tokens.push(token)
      skipWhitespace()
    } else {
      // Skip invalid character
      pos++
    }
  }

  // Validation
  if (inQuotes) {
    errors.push('Unmatched quote')
  }
  if (parenDepth > 0) {
    errors.push('Unmatched opening parenthesis')
  }

  // Extract field searches
  const fields: FieldSearch[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'FIELD' && token.field) {
      // Extract operator if present (for duration/year)
      let operator: FieldSearch['operator'] = '='
      const valueStr = token.value
      if (token.field === 'duration' || token.field === 'year') {
        // Check if value starts with operator
        const opMatch = /^([><=]+)\s*(.+)$/.exec(valueStr)
        if (opMatch) {
          const op = opMatch[1]
          if (op === '>=') operator = '>='
          else if (op === '<=') operator = '<='
          else if (op === '>') operator = '>'
          else if (op === '<') operator = '<'
          else if (op === '=') operator = '='
          fields.push({
            field: token.field as 'artist' | 'album' | 'year' | 'duration',
            value: opMatch[2],
            operator,
          })
        } else {
          fields.push({
            field: token.field as 'artist' | 'album' | 'year' | 'duration',
            value: valueStr,
            operator,
          })
        }
      } else {
        fields.push({
          field: token.field as 'artist' | 'album' | 'year' | 'duration',
          value: valueStr,
        })
      }
    }
  }

  // Check for operators and features
  const hasOperators = tokens.some((t) => t.type === 'AND' || t.type === 'OR' || t.type === 'NOT')
  const hasFields = fields.length > 0
  const hasQuotes = tokens.some((t) => t.type === 'QUOTED')
  const hasGrouping = tokens.some((t) => t.type === 'LPAREN' || t.type === 'RPAREN')

  return {
    tokens,
    hasOperators,
    hasFields,
    hasQuotes,
    hasGrouping,
    fields,
    errors,
  }
}

/**
 * Check if a query is valid
 * @param query - Search query string
 * @returns True if query is valid
 */
export function isValidQuery(query: string): boolean {
  const parsed = parseSearchQuery(query)
  return parsed.errors.length === 0
}

/**
 * Get query validation errors
 * @param query - Search query string
 * @returns Array of error messages
 */
export function getQueryErrors(query: string): string[] {
  const parsed = parseSearchQuery(query)
  return parsed.errors
}

