import { useState, useEffect } from 'react'
import './App.css'
import WebXRScene from './components/WebXRScene'

function App() {
  const [isXRSupported, setIsXRSupported] = useState<boolean | null>(null)
  const [xrSession, setXrSession] = useState<XRSession | null>(null)

  // Check WebXR AR support
  const checkXRSupport = async () => {
    if (navigator.xr) {
      const supported = await navigator.xr.isSessionSupported('immersive-ar')
      setIsXRSupported(supported)
      return supported
    }
    setIsXRSupported(false)
    return false
  }

  // Start AR session
  const startXRSession = async () => {
    if (!navigator.xr) {
      alert('WebXR is not supported in this browser')
      return
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking', 'light-estimation']
      })
      
      setXrSession(session)
      
      session.addEventListener('end', () => {
        setXrSession(null)
      })
    } catch (error) {
      console.error('Error starting AR session:', error)
      alert('Failed to start AR session. Make sure your Quest is connected and in developer mode.')
    }
  }

  // Stop XR session
  const stopXRSession = () => {
    if (xrSession) {
      xrSession.end()
    }
  }

  // Check support on mount
  useEffect(() => {
    checkXRSupport()
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0, position: 'relative' }}>
      <WebXRScene xrSession={xrSession} />
      
      {/* Control UI */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>WebXR AR Test</h2>
        <p style={{ margin: '5px 0' }}>
          XR Support: {isXRSupported === null ? 'Checking...' : isXRSupported ? '✅ Supported' : '❌ Not Supported'}
        </p>
        <p style={{ margin: '5px 0' }}>
          Session: {xrSession ? '🟢 Active' : '⚪ Inactive'}
        </p>
        <div style={{ marginTop: '15px' }}>
          {!xrSession ? (
            <button
              onClick={startXRSession}
              disabled={!isXRSupported}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                cursor: isXRSupported ? 'pointer' : 'not-allowed',
                backgroundColor: isXRSupported ? '#4CAF50' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px'
              }}
            >
              Enter AR
            </button>
          ) : (
            <button
              onClick={stopXRSession}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px'
              }}
            >
              Exit AR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
