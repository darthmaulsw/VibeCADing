import React, { useState } from 'react'
import './ApiTestPage.css'
import MicToFlask from '../libs/test'

function ApiTestPage() {
  // OpenSCAD State
  const [openscadInput, setOpenscadInput] = useState<string>('')
  const [openscadLoading, setOpenscadLoading] = useState<boolean>(false)
  const [openscadOutput, setOpenscadOutput] = useState<string>('')

  // ElevenLabs Conversation State
  const [elevenlabsInput, setElevenlabsInput] = useState<string>('')
  const [elevenlabsLoading, setElevenlabsLoading] = useState<boolean>(false)
  const [elevenlabsOutput, setElevenlabsOutput] = useState<string>('')

  // Hunyuan Image Model State
  const [hunyuanCaption, setHunyuanCaption] = useState<string>('')
  const [hunyuanImage, setHunyuanImage] = useState<File | null>(null)
  const [hunyuanMvImages, setHunyuanMvImages] = useState<{
    front?: File
    back?: File
    left?: File
    right?: File
  }>({})
  const [hunyuanLoading, setHunyuanLoading] = useState<boolean>(false)
  const [hunyuanOutput, setHunyuanOutput] = useState<string>('')
  const [hunyuanModelUrl, setHunyuanModelUrl] = useState<string | null>(null)

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

  // Hunyuan Image Model API Test
  const handleHunyuanImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'front' | 'back' | 'left' | 'right') => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === 'main') {
        setHunyuanImage(file)
      } else {
        setHunyuanMvImages(prev => ({ ...prev, [type]: file }))
      }
    }
  }

  const handleHunyuan = async () => {
    if (!hunyuanImage) {
      setHunyuanOutput('Error: Please upload a main image')
      return
    }

    setHunyuanLoading(true)
    setHunyuanOutput('')
    setHunyuanModelUrl(null)

    const updateStatus = (message: string) => {
      const timestamp = new Date().toLocaleTimeString()
      setHunyuanOutput(prev => prev ? `${prev}\n[${timestamp}] ${message}` : `[${timestamp}] ${message}`)
      console.log(`[Hunyuan] ${message}`)
    }

    try {
      updateStatus('🚀 Starting 3D model generation...')
      updateStatus('📤 Preparing files for upload...')

      const formData = new FormData()
      formData.append('image', hunyuanImage)
      formData.append('caption', hunyuanCaption)
      
      if (hunyuanMvImages.front) {
        formData.append('mv_image_front', hunyuanMvImages.front)
        updateStatus('✅ Added front view image')
      }
      if (hunyuanMvImages.back) {
        formData.append('mv_image_back', hunyuanMvImages.back)
        updateStatus('✅ Added back view image')
      }
      if (hunyuanMvImages.left) {
        formData.append('mv_image_left', hunyuanMvImages.left)
        updateStatus('✅ Added left view image')
      }
      if (hunyuanMvImages.right) {
        formData.append('mv_image_right', hunyuanMvImages.right)
        updateStatus('✅ Added right view image')
      }

      updateStatus('📡 Sending request to backend server...')
      updateStatus('⏳ Waiting for server response (this may take several minutes)...')

      const startTime = Date.now()
      const res = await fetch('/api/hunyuan/generate', {
        method: 'POST',
        body: formData,
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      updateStatus(`📥 Received response after ${elapsed} seconds`)
      updateStatus(`📊 Response status: ${res.status}`)

      console.log('Response status:', res.status)
      console.log('Response headers:', res.headers)
      
      updateStatus('📝 Reading response data...')
      const text = await res.text()
      console.log('Response text:', text)
      
      updateStatus('🔍 Parsing response...')
      let data
      if (!text) {
        data = { error: 'Empty response from server', status: res.status }
        updateStatus('⚠️ Warning: Empty response received')
      } else {
        try {
          data = JSON.parse(text)
          updateStatus('✅ Successfully parsed JSON response')
        } catch (e) {
          data = { error: 'Invalid JSON response', raw: text.substring(0, 500), status: res.status }
          updateStatus('⚠️ Warning: Could not parse JSON, showing raw response')
        }
      }
      
      console.log('Parsed data:', data)
      
      // Extract model URL - handle Gradio response format
      const extractModelUrl = (obj: any): string | null => {
        if (!obj) return null
        
        // If it's already a string, use it
        if (typeof obj === 'string') {
          // Convert relative paths to full URLs
          if (obj.startsWith('/tmp/gradio/')) {
            return `https://tencent-hunyuan3d-2.hf.space/file=${obj}`
          }
          return obj
        }
        
        // If it's an object with __type__ and value (Gradio format)
        if (typeof obj === 'object' && obj !== null) {
          if ('__type__' in obj && 'value' in obj) {
            const url = obj.value
            if (typeof url === 'string') {
              if (url.startsWith('/tmp/gradio/')) {
                return `https://tencent-hunyuan3d-2.hf.space/file=${url}`
              }
              return url
            }
          } else if ('value' in obj) {
            const url = obj.value
            if (typeof url === 'string') {
              if (url.startsWith('/tmp/gradio/')) {
                return `https://tencent-hunyuan3d-2.hf.space/file=${url}`
              }
              return url
            }
          }
        }
        
        return null
      }
      
      // Try to extract model URL from various places in the response
      let modelUrl: string | null = null
      if (data.model_url) {
        modelUrl = extractModelUrl(data.model_url)
      }
      
      // If not found in model_url, try the result array
      if (!modelUrl && data.result && Array.isArray(data.result) && data.result.length > 0) {
        modelUrl = extractModelUrl(data.result[0])
      }
      
      // Display result with download link if model_url is available
      if (data.success && modelUrl) {
        updateStatus('🎉 3D model generation completed successfully!')
        updateStatus(`📦 GLB model URL: ${modelUrl}`)
        setHunyuanModelUrl(modelUrl)
      } else if (data.error) {
        updateStatus(`❌ Error: ${data.error}`)
        setHunyuanModelUrl(null)
      } else {
        updateStatus('⚠️ Response received but no model URL found')
        setHunyuanModelUrl(null)
      }
      
      // Add full JSON response at the end
      const output = JSON.stringify(data, null, 2)
      setHunyuanOutput(prev => prev ? `${prev}\n\n--- Full Response ---\n${output}` : output)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateStatus(`❌ Request failed: ${errorMessage}`)
      setHunyuanOutput(prev => prev ? `${prev}\n\n❌ Error: ${errorMessage}` : `❌ Error: ${errorMessage}`)
      setHunyuanModelUrl(null)
    } finally {
      setHunyuanLoading(false)
      updateStatus('🏁 Request completed')
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

      {/* Hunyuan Image Model API Section */}
      <div className="api-section">
        <h2>Hunyuan 3D Model Generation</h2>
        <div className="input-output-container">
          <div className="input-box">
            <label>Caption (optional):</label>
            <textarea
              value={hunyuanCaption}
              onChange={(e) => setHunyuanCaption(e.target.value)}
              placeholder="e.g., Eric Zou, a male human being, Asian ethnicity"
              rows={2}
            />
            <label>Main Image (required):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleHunyuanImageChange(e, 'main')}
            />
            {hunyuanImage && <span className="file-name">{hunyuanImage.name}</span>}
            
            <div className="mv-images-section">
              <label>Multi-view Images (optional):</label>
              <div className="mv-images-grid">
                <div>
                  <label>Front:</label>
                  <input type="file" accept="image/*" onChange={(e) => handleHunyuanImageChange(e, 'front')} />
                  {hunyuanMvImages.front && <span className="file-name">{hunyuanMvImages.front.name}</span>}
                </div>
                <div>
                  <label>Back:</label>
                  <input type="file" accept="image/*" onChange={(e) => handleHunyuanImageChange(e, 'back')} />
                  {hunyuanMvImages.back && <span className="file-name">{hunyuanMvImages.back.name}</span>}
                </div>
                <div>
                  <label>Left:</label>
                  <input type="file" accept="image/*" onChange={(e) => handleHunyuanImageChange(e, 'left')} />
                  {hunyuanMvImages.left && <span className="file-name">{hunyuanMvImages.left.name}</span>}
                </div>
                <div>
                  <label>Right:</label>
                  <input type="file" accept="image/*" onChange={(e) => handleHunyuanImageChange(e, 'right')} />
                  {hunyuanMvImages.right && <span className="file-name">{hunyuanMvImages.right.name}</span>}
                </div>
              </div>
            </div>
            
            <button onClick={handleHunyuan} disabled={hunyuanLoading || !hunyuanImage}>
              {hunyuanLoading ? '⏳ Generating 3D Model (this may take several minutes)...' : 'Generate 3D Model'}
            </button>
            {hunyuanLoading && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9rem' }}>
                ⏳ Generation in progress... Check the output box below for status updates.
              </div>
            )}
          </div>
          <div className="output-box">
            <label>Output (Status & Result):</label>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              maxHeight: '400px',
              overflowY: 'auto',
              backgroundColor: hunyuanLoading ? '#f0f8ff' : '#f9f9f9',
              padding: '1rem',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}>
              {hunyuanOutput || (hunyuanLoading ? '⏳ Waiting for generation to start...' : '3D model generation result will appear here...')}
            </pre>
            {hunyuanModelUrl && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
                <strong>📥 Download 3D Model (GLB):</strong>
                <br />
                <a 
                  href={hunyuanModelUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#1976d2', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {hunyuanModelUrl}
                </a>
                <br />
                <button 
                  onClick={() => window.open(hunyuanModelUrl, '_blank')}
                  style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Open/Download GLB File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="api-section">
        <h2>Media Recorder Test</h2>
        <div className="input-output-container">
          <div className="input-box">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Quick Mic Button</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MicToFlask endpoint="/api/transcribe"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiTestPage
