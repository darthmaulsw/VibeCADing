import { useState } from 'react'
import './ApiTestPage.css'

function ApiTestPage() {
  // OpenSCAD State
  const [openscadInput, setOpenscadInput] = useState<string>('')
  const [openscadLoading, setOpenscadLoading] = useState<boolean>(false)
  const [openscadOutput, setOpenscadOutput] = useState<string>('')

  // ElevenLabs Conversation State
  const [elevenlabsInput, setElevenlabsInput] = useState<string>('')
  const [elevenlabsLoading, setElevenlabsLoading] = useState<boolean>(false)
  const [elevenlabsOutput, setElevenlabsOutput] = useState<string>('')

  // OpenSCAD API Test
  const handleOpenSCAD = async () => {
    if (!openscadInput.trim()) return

    setOpenscadLoading(true)
    setOpenscadOutput('')

    try {
      const res = await fetch('/api/openscad/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: openscadInput }),
      })

      const data = await res.json()
      setOpenscadOutput(JSON.stringify(data, null, 2))
    } catch (error) {
      setOpenscadOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setOpenscadLoading(false)
    }
  }

  // ElevenLabs Conversation API Test
  const handleElevenLabs = async () => {
    if (!elevenlabsInput.trim()) return

    setElevenlabsLoading(true)
    setElevenlabsOutput('')

    try {
      const res = await fetch('/api/elevenlabs/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: elevenlabsInput }),
      })

      const data = await res.json()
      setElevenlabsOutput(JSON.stringify(data, null, 2))
    } catch (error) {
      setElevenlabsOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setElevenlabsLoading(false)
    }
  }

  return (
    <div className="api-test">
      {/* OpenSCAD API Section */}
      <div className="api-section">
        <h2>OpenSCAD API</h2>
        <div className="input-output-container">
          <div className="input-box">
            <label>Input (Description):</label>
            <textarea
              value={openscadInput}
              onChange={(e) => setOpenscadInput(e.target.value)}
              placeholder="Describe the 3D object you want to create..."
              rows={8}
            />
            <button onClick={handleOpenSCAD} disabled={openscadLoading || !openscadInput.trim()}>
              {openscadLoading ? 'Generating...' : 'Generate OpenSCAD'}
            </button>
          </div>
          <div className="output-box">
            <label>Output (OpenSCAD Code):</label>
            <pre>{openscadOutput || 'Generated code will appear here...'}</pre>
          </div>
        </div>
      </div>

      {/* ElevenLabs Conversation API Section */}
      <div className="api-section">
        <h2>ElevenLabs Conversation</h2>
        <div className="input-output-container">
          <div className="input-box">
            <label>Input (Message):</label>
            <textarea
              value={elevenlabsInput}
              onChange={(e) => setElevenlabsInput(e.target.value)}
              placeholder="Enter your message..."
              rows={8}
            />
            <button onClick={handleElevenLabs} disabled={elevenlabsLoading || !elevenlabsInput.trim()}>
              {elevenlabsLoading ? 'Processing...' : 'Send Message'}
            </button>
          </div>
          <div className="output-box">
            <label>Output (Response):</label>
            <pre>{elevenlabsOutput || 'Response will appear here...'}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiTestPage
