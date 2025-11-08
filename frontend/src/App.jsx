import { useState } from 'react'
import ApiTestPage from './components/ApiTestPage'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>VibeCADing</h1>
        <p>API Test Interface</p>
      </header>
      <main>
        <ApiTestPage />
      </main>
    </div>
  )
}

export default App

