'use client'

import { useState } from 'react'
import { storeTidalAuth, validateTidalAuth, getTidalTokenInstructions } from '@/lib/tidal-integration'

export function TidalAuthPanel() {
  const [authToken, setAuthToken] = useState('')
  const [tidalToken, setTidalToken] = useState('')
  const [tokenType, setTokenType] = useState('Bearer')
  const [countryCode, setCountryCode] = useState('US')
  const [userId, setUserId] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [isStored, setIsStored] = useState(false)

  const handleSaveAuth = () => {
    const auth = {
      accessToken: authToken,
      tokenType,
      tidalToken,
      userId: userId || 'demo-user',
      countryCode
    }

    if (validateTidalAuth(auth)) {
      storeTidalAuth(auth)
      setIsStored(true)
      setTimeout(() => setIsStored(false), 3000)
    } else {
      alert('Please fill in all required fields')
    }
  }

  const handleLoadDemo = () => {
    // Load demo auth for school project testing
    const demoAuth = {
      accessToken: 'demo_access_token_for_school_project',
      tokenType: 'Bearer',
      tidalToken: 'demo_tidal_token_for_school_project', 
      userId: 'demo-user',
      countryCode: 'US'
    }
    storeTidalAuth(demoAuth)
    setIsStored(true)
    setTimeout(() => setIsStored(false), 3000)
  }

  return (
    <div className="tidal-auth-panel">
      <div className="auth-header">
        <h3>🌊 Tidal Authentication</h3>
        <p className="auth-subtitle">For FLAC quality streaming</p>
      </div>

      <div className="auth-form">
        <div className="form-group">
          <label>Authorization Header:</label>
          <textarea
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>X-Tidal-Token:</label>
          <input
            type="text"
            value={tidalToken}
            onChange={(e) => setTidalToken(e.target.value)}
            placeholder="lYxxUKmG0sziI_8f_xvBqA"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Country Code:</label>
            <input
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              placeholder="US"
              maxLength={2}
            />
          </div>

          <div className="form-group">
            <label>User ID (optional):</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="123456789"
            />
          </div>
        </div>

        <div className="auth-buttons">
          <button onClick={handleSaveAuth} className="save-btn">
            💾 Save Authentication
          </button>
          <button onClick={handleLoadDemo} className="demo-btn">
            🎓 Load Demo Mode
          </button>
          <button 
            onClick={() => setShowInstructions(!showInstructions)} 
            className="instructions-btn"
          >
            📖 How to Get Tokens
          </button>
        </div>

        {isStored && (
          <div className="success-message">
            ✅ Authentication saved successfully!
          </div>
        )}

        {showInstructions && (
          <div className="instructions-panel">
            <h4>🔍 How to Get Tidal Tokens:</h4>
            <ol>
              {getTidalTokenInstructions().map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
            <div className="demo-note">
              <strong>🎓 School Project Note:</strong> You can also use "Demo Mode" to test the functionality without real tokens.
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .tidal-auth-panel {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 1.5rem;
          margin: 1rem 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .auth-header h3 {
          color: white;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
        }

        .auth-subtitle {
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          font-size: 0.9rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          color: white;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          color: white;
          font-family: monospace;
          font-size: 0.9rem;
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .auth-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .save-btn,
        .demo-btn,
        .instructions-btn {
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .save-btn {
          background: linear-gradient(45deg, #00b4db, #0083b0);
          color: white;
        }

        .demo-btn {
          background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
          color: white;
        }

        .instructions-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .save-btn:hover,
        .demo-btn:hover,
        .instructions-btn:hover {
          transform: scale(1.05);
        }

        .success-message {
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid rgba(76, 175, 80, 0.5);
          color: #4caf50;
          padding: 0.75rem;
          border-radius: 6px;
          text-align: center;
          margin-top: 1rem;
        }

        .instructions-panel {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .instructions-panel h4 {
          color: white;
          margin: 0 0 1rem 0;
        }

        .instructions-panel ol {
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          padding-left: 1.5rem;
        }

        .instructions-panel li {
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .demo-note {
          background: rgba(255, 193, 7, 0.2);
          border: 1px solid rgba(255, 193, 7, 0.5);
          border-radius: 6px;
          padding: 0.75rem;
          margin-top: 1rem;
          color: #ffc107;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .auth-buttons {
            flex-direction: column;
          }

          .tidal-auth-panel {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
