import { useState } from 'react'
import './ApiTestPage.css'

function ApiTestPage() {
  // TTS State
  const [ttsText, setTtsText] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsResult, setTtsResult] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)

  // OpenSCAD State
  const [openscadPrompt, setOpenscadPrompt] = useState('')
  const [openscadLoading, setOpenscadLoading] = useState(false)
  const [openscadResult, setOpenscadResult] = useState(null)

  // Gemini Summary State
  const [summaryPrompt, setSummaryPrompt] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryResult, setSummaryResult] = useState(null)

  // TTS API Test
  const testTTS = async () => {
    if (!ttsText.trim()) {
      alert('Please enter some text for TTS')
      return
    }

    setTtsLoading(true)
    setTtsResult(null)
    setAudioUrl(null)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: ttsText }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setTtsResult(data)

      // If there's an audio URL in the response, set it
      if (data.audio_url) {
        setAudioUrl(data.audio_url)
      }
    } catch (error) {
      setTtsResult({ error: error.message })
    } finally {
      setTtsLoading(false)
    }
  }

  // OpenSCAD API Test
  const testOpenSCAD = async () => {
    if (!openscadPrompt.trim()) {
      alert('Please enter a prompt for OpenSCAD generation')
      return
    }

    setOpenscadLoading(true)
    setOpenscadResult(null)

    try {
      const response = await fetch('/api/openscad/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: openscadPrompt }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setOpenscadResult(data)
    } catch (error) {
      setOpenscadResult({ error: error.message })
    } finally {
      setOpenscadLoading(false)
    }
  }

  // Gemini Summary API Test
  const testGeminiSummary = async () => {
    if (!summaryPrompt.trim()) {
      alert('Please enter a prompt for Gemini summary')
      return
    }

    setSummaryLoading(true)
    setSummaryResult(null)

    try {
      const response = await fetch('/api/gemini/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: summaryPrompt }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setSummaryResult(data)
    } catch (error) {
      setSummaryResult({ error: error.message })
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="api-test-page">
      <div className="test-section">
        <h2>Text-to-Speech (TTS) Test</h2>
        <div className="test-controls">
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            rows="4"
          />
          <button onClick={testTTS} disabled={ttsLoading}>
            {ttsLoading ? 'Processing...' : 'Generate Speech'}
          </button>
        </div>
        {ttsResult && (
          <div className="test-result">
            <h3>Response:</h3>
            <pre>{JSON.stringify(ttsResult, null, 2)}</pre>
            {audioUrl && (
              <div className="audio-player">
                <h4>Audio Player:</h4>
                <audio controls src={audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="test-section">
        <h2>OpenSCAD Code Generation Test</h2>
        <div className="test-controls">
          <textarea
            value={openscadPrompt}
            onChange={(e) => setOpenscadPrompt(e.target.value)}
            placeholder="Describe the 3D object you want to create (e.g., 'create a cube with a sphere on top')..."
            rows="4"
          />
          <button onClick={testOpenSCAD} disabled={openscadLoading}>
            {openscadLoading ? 'Generating...' : 'Generate OpenSCAD Code'}
          </button>
        </div>
        {openscadResult && (
          <div className="test-result">
            <h3>Response:</h3>
            <pre>{JSON.stringify(openscadResult, null, 2)}</pre>
            {openscadResult.code && (
              <div className="code-display">
                <h4>Generated OpenSCAD Code:</h4>
                <pre className="code-block">{openscadResult.code}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="test-section">
        <h2>Gemini Summary Test</h2>
        <div className="test-controls">
          <textarea
            value={summaryPrompt}
            onChange={(e) => setSummaryPrompt(e.target.value)}
            placeholder="Enter text or context to summarize..."
            rows="4"
          />
          <button onClick={testGeminiSummary} disabled={summaryLoading}>
            {summaryLoading ? 'Summarizing...' : 'Get Summary'}
          </button>
        </div>
        {summaryResult && (
          <div className="test-result">
            <h3>Response:</h3>
            <pre>{JSON.stringify(summaryResult, null, 2)}</pre>
            {summaryResult.summary && (
              <div className="summary-display">
                <h4>Summary:</h4>
                <p>{summaryResult.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ApiTestPage

