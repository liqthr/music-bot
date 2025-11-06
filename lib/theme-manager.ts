/**
 * Theme management utilities
 * Handles theme application, system preference detection, and color scheme definitions
 */

import type { ThemeSettings, ColorScheme, ThemeMode, ColorSchemeDefinition } from './types'
import { getItem, setItem } from './storage'

/**
 * Default theme settings
 */
export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  colorScheme: 'default',
  customBackground: null,
  fontSize: 1.0,
}

/**
 * Color scheme definitions for light and dark modes
 */
export const COLOR_SCHEMES: Record<ColorScheme, { light: ColorSchemeDefinition; dark: ColorSchemeDefinition }> = {
  default: {
    light: {
      name: 'Default',
      primary: '#8B5CF6', // Purple
      secondary: '#3B82F6', // Blue
      accent: '#EC4899', // Pink
      bg: '#FFFFFF',
      bgSecondary: '#F9FAFB',
      text: '#111827',
      textDim: '#6B7280',
    },
    dark: {
      name: 'Default',
      primary: '#8B5CF6', // Purple
      secondary: '#3B82F6', // Blue
      accent: '#EC4899', // Pink
      bg: '#0F172A',
      bgSecondary: '#1E293B',
      text: '#F1F5F9',
      textDim: '#94A3B8',
    },
  },
  ocean: {
    light: {
      name: 'Ocean',
      primary: '#06B6D4', // Cyan
      secondary: '#0891B2', // Teal
      accent: '#0EA5E9', // Sky blue
      bg: '#F0FDFA',
      bgSecondary: '#CCFBF1',
      text: '#0F172A',
      textDim: '#475569',
    },
    dark: {
      name: 'Ocean',
      primary: '#06B6D4', // Cyan
      secondary: '#0891B2', // Teal
      accent: '#0EA5E9', // Sky blue
      bg: '#0C1E2E',
      bgSecondary: '#164E63',
      text: '#E0F2FE',
      textDim: '#7DD3FC',
    },
  },
  sunset: {
    light: {
      name: 'Sunset',
      primary: '#F97316', // Orange
      secondary: '#EC4899', // Pink
      accent: '#F59E0B', // Amber
      bg: '#FFF7ED',
      bgSecondary: '#FFEDD5',
      text: '#1C1917',
      textDim: '#78716C',
    },
    dark: {
      name: 'Sunset',
      primary: '#F97316', // Orange
      secondary: '#EC4899', // Pink
      accent: '#F59E0B', // Amber
      bg: '#1C1917',
      bgSecondary: '#292524',
      text: '#FED7AA',
      textDim: '#FBBF24',
    },
  },
  forest: {
    light: {
      name: 'Forest',
      primary: '#10B981', // Green
      secondary: '#059669', // Emerald
      accent: '#84CC16', // Lime
      bg: '#F0FDF4',
      bgSecondary: '#DCFCE7',
      text: '#14532D',
      textDim: '#166534',
    },
    dark: {
      name: 'Forest',
      primary: '#10B981', // Green
      secondary: '#059669', // Emerald
      accent: '#84CC16', // Lime
      bg: '#0A1F0A',
      bgSecondary: '#14532D',
      text: '#D1FAE5',
      textDim: '#6EE7B7',
    },
  },
  monochrome: {
    light: {
      name: 'Monochrome',
      primary: '#4B5563', // Gray
      secondary: '#6B7280', // Gray
      accent: '#9CA3AF', // Gray
      bg: '#FFFFFF',
      bgSecondary: '#F9FAFB',
      text: '#111827',
      textDim: '#6B7280',
    },
    dark: {
      name: 'Monochrome',
      primary: '#9CA3AF', // Gray
      secondary: '#D1D5DB', // Gray
      accent: '#E5E7EB', // Gray
      bg: '#111827',
      bgSecondary: '#1F2937',
      text: '#F9FAFB',
      textDim: '#9CA3AF',
    },
  },
}

/**
 * Detect system color scheme preference
 * @returns 'light' or 'dark'
 */
export function detectSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark' // Default to dark for SSR
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

/**
 * Get effective theme mode (resolves 'system' to actual mode)
 * @param mode - Theme mode setting
 * @returns Effective mode ('light' or 'dark')
 */
export function getEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return detectSystemPreference()
  }
  return mode
}

/**
 * Apply theme to document
 * @param settings - Theme settings to apply
 */
export function applyTheme(settings: ThemeSettings): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const effectiveMode = getEffectiveMode(settings.mode)
  const scheme = COLOR_SCHEMES[settings.colorScheme]
  const colors = effectiveMode === 'light' ? scheme.light : scheme.dark

  // Apply color scheme
  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--secondary', colors.secondary)
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--bg', colors.bg)
  root.style.setProperty('--bg-secondary', colors.bgSecondary)
  root.style.setProperty('--text', colors.text)
  root.style.setProperty('--text-dim', colors.textDim)

  // Apply font size
  root.style.setProperty('--font-size-multiplier', settings.fontSize.toString())

  // Apply custom background
  if (settings.customBackground) {
    root.style.setProperty('--custom-bg-image', `url(${settings.customBackground})`)
    document.body.classList.add('has-custom-bg')
  } else {
    root.style.removeProperty('--custom-bg-image')
    document.body.classList.remove('has-custom-bg')
  }

  // Apply theme mode class
  root.classList.remove('theme-light', 'theme-dark')
  root.classList.add(`theme-${effectiveMode}`)
}

/**
 * Load theme settings from localStorage
 * @returns Theme settings or default if not found
 */
export function loadThemeSettings(): ThemeSettings {
  const saved = getItem<ThemeSettings>('themeSettings')
  if (saved) {
    return saved
  }

  // First time load - detect system preference
  const systemMode = detectSystemPreference()
  return {
    ...DEFAULT_THEME,
    mode: 'system',
  }
}

/**
 * Save theme settings to localStorage
 * @param settings - Theme settings to save
 */
export function saveThemeSettings(settings: ThemeSettings): void {
  setItem('themeSettings', settings)
}

/**
 * Convert hex color to RGB
 * @param hex - Hex color string
 * @returns RGB object or null
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return { r, g, b }
  }
  
  // Handle 6-digit hex
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return { r, g, b }
  }
  
  return null
}

/**
 * Convert image file to base64 string
 * @param file - Image file
 * @returns Promise resolving to base64 string
 */
export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate input is a File object
    if (!(file instanceof File)) {
      reject(new Error('Invalid input: expected File object'))
      return
    }

    // Validate file type is an image
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('Invalid file type: expected image file'))
      return
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      reject(new Error(`File size exceeds limit: ${file.size} bytes (max ${maxSize} bytes)`))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read image file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Remove custom background
 */
export function removeCustomBackground(settings: ThemeSettings): ThemeSettings {
  return {
    ...settings,
    customBackground: null,
  }
}

