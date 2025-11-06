'use client'

import { useState, useRef, useEffect } from 'react'
import type { ThemeSettings, ColorScheme, ThemeMode } from '@/lib/types'
import { COLOR_SCHEMES } from '@/lib/theme-manager'
import { imageToBase64 } from '@/lib/theme-manager'

interface ThemeSelectorProps {
  settings: ThemeSettings
  onSettingsChange: (settings: ThemeSettings) => void
  isOpen: boolean
  onClose: () => void
}

/**
 * Theme selector component with light/dark toggle, color schemes, and custom background
 */
export function ThemeSelector({
  settings,
  onSettingsChange,
  isOpen,
  onClose,
}: ThemeSelectorProps) {
  const [localSettings, setLocalSettings] = useState<ThemeSettings>(settings)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  // Handle mode change
  const handleModeChange = (mode: ThemeMode) => {
    const newSettings = { ...localSettings, mode }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  // Handle color scheme change
  const handleColorSchemeChange = (scheme: ColorScheme) => {
    const newSettings = { ...localSettings, colorScheme: scheme }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  // Handle font size change
  const handleFontSizeChange = (fontSize: number) => {
    const newSettings = { ...localSettings, fontSize }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  // Handle background upload
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    try {
      const base64 = await imageToBase64(file)
      const newSettings = { ...localSettings, customBackground: base64 }
      setLocalSettings(newSettings)
      onSettingsChange(newSettings)
    } catch (error) {
      console.error('Error uploading background:', error)
      alert('Failed to upload background image')
    }
  }

  // Handle remove background
  const handleRemoveBackground = () => {
    const newSettings = { ...localSettings, customBackground: null }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div className="theme-selector-overlay" onClick={onClose}></div>

      {/* Theme Selector Panel */}
      <div className="theme-selector-panel">
        <div className="theme-selector-header">
          <h3 className="theme-selector-title">Theme Settings</h3>
          <button
            type="button"
            className="theme-selector-close"
            onClick={onClose}
            aria-label="Close theme settings"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="theme-selector-content">
          {/* Light/Dark Mode Toggle */}
          <div className="theme-section">
            <label className="theme-section-label">Theme Mode</label>
            <div className="theme-mode-toggle">
              <button
                type="button"
                className={`theme-mode-btn ${localSettings.mode === 'light' ? 'active' : ''}`}
                onClick={() => handleModeChange('light')}
              >
                <i className="fas fa-sun"></i>
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`theme-mode-btn ${localSettings.mode === 'dark' ? 'active' : ''}`}
                onClick={() => handleModeChange('dark')}
              >
                <i className="fas fa-moon"></i>
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-mode-btn ${localSettings.mode === 'system' ? 'active' : ''}`}
                onClick={() => handleModeChange('system')}
              >
                <i className="fas fa-desktop"></i>
                <span>System</span>
              </button>
            </div>
          </div>

          {/* Color Scheme Selector */}
          <div className="theme-section">
            <label className="theme-section-label">Color Scheme</label>
            <div className="color-scheme-grid">
              {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => {
                const isActive = localSettings.colorScheme === key
                // Use effective mode to determine which colors to show
                const effectiveMode = localSettings.mode === 'system' 
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : localSettings.mode
                const colors = effectiveMode === 'light' ? scheme.light : scheme.dark
                
                return (
                  <button
                    key={key}
                    type="button"
                    className={`color-scheme-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleColorSchemeChange(key as ColorScheme)}
                    title={scheme.light.name}
                  >
                    <div
                      className="color-scheme-preview"
                      style={{
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                      }}
                    >
                      <div
                        className="color-scheme-accent"
                        style={{ background: colors.accent }}
                      ></div>
                    </div>
                    <span className="color-scheme-name">{scheme.light.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Background */}
          <div className="theme-section">
            <label className="theme-section-label">Custom Background</label>
            <div className="custom-background-section">
              {localSettings.customBackground ? (
                <div className="custom-background-preview">
                  <img src={localSettings.customBackground} alt="Custom background" />
                  <button
                    type="button"
                    className="remove-background-btn"
                    onClick={handleRemoveBackground}
                    aria-label="Remove custom background"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ) : (
                <div className="custom-background-upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    style={{ display: 'none' }}
                    id="background-upload"
                  />
                  <label htmlFor="background-upload" className="upload-background-btn">
                    <i className="fas fa-upload"></i>
                    <span>Upload Background</span>
                  </label>
                  <p className="upload-hint">Max 5MB, JPG/PNG/WebP</p>
                </div>
              )}
            </div>
          </div>

          {/* Font Size */}
          <div className="theme-section">
            <label className="theme-section-label">
              Font Size: {Math.round(localSettings.fontSize * 100)}%
            </label>
            <input
              type="range"
              className="font-size-slider"
              min="0.8"
              max="1.2"
              step="0.05"
              value={localSettings.fontSize}
              onChange={(e) => handleFontSizeChange(parseFloat(e.target.value))}
              aria-label="Font size"
            />
          </div>
        </div>
      </div>
    </>
  )
}

