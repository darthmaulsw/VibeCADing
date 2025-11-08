import { useState } from 'react'
import './ApiTestPage.css'

function ApiTestPage() {
  const [input, setInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [response, setResponse] = useState<string>('')

  const handleTest = async () => {
    if (!input.trim()) return

    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })

      const data = await res.json()
      setResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="api-test">
      <div className="test-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter test input..."
          rows={4}
        />
        <button onClick={handleTest} disabled={loading}>
          {loading ? 'Testing...' : 'Test'}
        </button>
      </div>
      {response && (
        <div className="response-box">
          <pre>{response}</pre>
        </div>
      )}
    </div>
  )
}

export default ApiTestPage

