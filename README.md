# VibeCADing

Voice-driven 3D CAD model generation. Speak your ideas and see them rendered in 3D.

VibeCADing is a full-stack application that combines speech recognition, AI-powered CAD code generation, and real-time 3D visualization. Users describe 3D objects using voice input, and the system generates OpenSCAD code, converts it to STL files, and displays interactive 3D models.

---

## Features

- Voice Input - Record audio descriptions of 3D objects
- AI-Powered Generation - Uses Claude/GPT to generate OpenSCAD code from natural language
- Iterative Refinement - Modify existing models with voice commands
- 3D Visualization - Real-time rendering with Three.js
- Model Management - Save, load, and organize generated models via Supabase
- Audio Feedback - Text-to-speech status updates and summaries

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Port 5173)                      │
│  styled-pages/ - Vite + React + TypeScript + Three.js          │
│  • Voice recording & transcription UI                           │
│  • 3D viewport with STL/GLB rendering                           │
│  • Model library & editor interface                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP/REST APIs
                 │
    ┌────────────┴────────────┬────────────────────────┐
    │                         │                        │
┌───▼──────────┐  ┌──────────▼─────────┐  ┌──────────▼──────────┐
│ Flask Server │  │ Node.js Converter  │  │    Supabase DB      │
│  (Port 5000) │  │   (Port 3001)      │  │   (PostgreSQL)      │
│              │  │                    │  │                     │
│ • /transcribe│  │ • /convert-scad    │  │ • User accounts     │
│ • /generation│  │ • /files/*         │  │ • Model storage     │
│ • /summary   │  │                    │  │ • SCAD code         │
└──────┬───────┘  └────────────────────┘  └─────────────────────┘
       │
       │ Orchestrates
       │
┌──────▼─────────────────────────────────────────────────────────┐
│              Backend Services & AI Agents                       │
│  • ElevenLabs - Speech-to-text & text-to-speech               │
│  • Dedalus - Agentic AI orchestration                         │
│  • Claude Sonnet 4 - OpenSCAD code generation                 │
│  • OpenSCAD WASM - STL compilation                            │
└───────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Flask Backend (`backend/app.py`)

The Flask server acts as the central orchestrator that handles the voice-to-model pipeline.

#### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/transcribe` | POST | Converts audio to text, generates status audio, optionally triggers SCAD generation |
| `/api/generation/job/<id>` | GET | Polls async generation job status |
| `/api/generate-model-summary` | POST | Creates natural language summary of generated model |
| `/api/getresponse` | GET | Generates status update text-to-speech |
| `/api/iterate` | POST | Modifies existing model based on user feedback |

#### Core Workflow

1. **Audio Upload** (`/api/transcribe`)
   - Receives WebM audio from frontend
   - Sends to ElevenLabs for speech-to-text transcription
   - Analyzes intent (new model vs. iteration)
   - Generates TTS status audio
   - Returns job ID for async tracking

2. **CAD Generation Pipeline**
   ```
   User Prompt → Dedalus Agent → Claude Sonnet 4
                                      ↓
   Prompt Engineering ← MCP Tools (Brave Search, Context7)
                                      ↓
   OpenSCAD Code → Markdown Fence Removal → output.scad
   ```

3. **Async Job Management**
   - Generation runs in background thread
   - Job status transitions: pending, running, done, error
   - Frontend polls `/api/generation/job/<id>` every 2.5 seconds
   - Returns SCAD code when complete

4. **Model Summary**
   - After viewport loads the model
   - Analyzes SCAD code with AI
   - Generates concise description
   - Returns text + TTS audio

### CAD Generation Modules

#### `backend/fin.py` - New Model Generation

- **`get_cad(user_prompt)`** - Main async function
  - Uses Dedalus orchestration framework
  - Creates detailed prompt via `mkprompt()` tool
  - Calls Claude to generate OpenSCAD code
  - Writes to `output.scad`

- **`gen_cad(prompt)`** - Claude API wrapper
  - Sends prompt to Claude Sonnet 4
  - Extracts code blocks from response
  - Strips markdown fences
  - Handles max tokens (20,000)

- **Prompt Engineering**
  - Uses MCAD library checks (verifies against GitHub)
  - Enforces attached geometry (no floating bodies)
  - Prevents hallucinated imports
  - Specifies code-only output (no explanatory text)

#### `backend/testing.py` - Model Iteration

- **`iterate_cad(user_prompt, scad_code)`**
  - Loads existing SCAD code from Supabase
  - Creates modification prompt via `editprompt()` tool
  - Generates updated code
  - Writes to `outputIterated.scad`
  - Updates database with new version

### Node.js Converter (`backend/nodeserv/server.js`)

A dedicated microservice for OpenSCAD to STL conversion using WASM.

#### Design Rationale

- **Sandboxing**: Isolates OpenSCAD compilation from Flask
- **Performance**: Non-blocking STL generation
- **Scalability**: Can run multiple converter instances
- **Error Handling**: Prevents SCAD crashes from affecting main backend

#### Conversion Pipeline

```javascript
POST /convert-scad
  ↓
Markdown Fence Removal (```openscad → clean code)
  ↓
Variable Hoisting (module vars → global scope)
  ↓
OpenSCAD WASM Compilation
  ↓
STL Binary Buffer
  ↓
Save to public/generated/model_*.stl
  ↓
Return URL: /files/generated/model_*.stl
```

#### Advanced Features

- **Fence Stripping**: Handles various markdown fence formats
- **Variable Hoisting**: Auto-detects variables defined inside modules but used in assembly
- **Error Logging**: Saves failed SCAD to `failed_*.scad` for debugging
- **Static Serving**: `/files/*` endpoint serves generated STL files
- **Streaming Mode**: Optional raw STL response (no file saving)

### Database (Supabase)

**Table: `models`**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- name (text) - User's original prompt
- scad_code (text) - OpenSCAD source
- created_at (timestamp)
```

**Features:**
- Row-level security for multi-user support
- Real-time subscriptions (not currently used)
- Storage bucket for future GLB/STL hosting

---

## Setup

### Prerequisites

- **Node.js 18+** (for frontend & converter)
- **Python 3.10+** (for Flask backend)
- **API Keys Required:**
  - ElevenLabs API key
  - Dedalus API key
  - Anthropic API key (Claude)
  - Supabase URL + Anon Key

### Environment Variables

Create `.env` in project root:

```bash
# Backend APIs
ELEVENLABS_API_KEY=your_elevenlabs_key
DEDALUS_API_KEY=your_dedalus_key
CLAUDE_API_KEY=your_claude_key

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Development
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
FLASK_ENV=development
```

### Installation

#### 1. Frontend (styled-pages)

```bash
cd styled-pages
npm install
npm run dev  # Runs on port 5173
```

#### 2. Flask Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
python app.py  # Runs on port 5000
```

#### 3. Node Converter

```bash
cd backend/nodeserv
npm install
node server.js  # Runs on port 3001
```

### Vite Proxy Configuration

The frontend proxies API requests:

```typescript
// styled-pages/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:5000',        // Flask backend
    '/convert-scad': 'http://localhost:3001', // OpenSCAD converter
    '/files': 'http://localhost:3001'         // Static STL files
  }
}
```

---

## Project Structure

```
VibeCADing/
├── backend/
│   ├── app.py                    # Flask server (main orchestrator)
│   ├── fin.py                    # New model generation (get_cad)
│   ├── testing.py                # Model iteration (iterate_cad)
│   ├── prompts.py                # Prompt engineering tools
│   ├── output.scad               # Generated SCAD (new models)
│   ├── outputIterated.scad       # Generated SCAD (iterations)
│   └── nodeserv/
│       ├── server.js             # OpenSCAD→STL converter
│       ├── public/generated/     # STL file output directory
│       └── README.md             # Converter documentation
│
├── styled-pages/                 # Frontend (Vite + React + TypeScript)
│   ├── src/
│   │   ├── App.tsx               # Main app, screen navigation
│   │   ├── components/
│   │   │   └── landing/
│   │   │       ├── VoiceBot.tsx  # Voice recording & job polling
│   │   │       └── LandingScreen.tsx
│   │   ├── three/
│   │   │   └── sceneSetup.ts    # Three.js 3D viewer, STL loader
│   │   └── libs/
│   │       └── APIcalls.ts       # Supabase & API client
│   ├── vite.config.ts            # Proxy configuration
│   └── public/                   # Static assets
│
├── requirements.txt              # Python dependencies
```

---

## Frontend Architecture

### Main Components

#### `App.tsx`
- Screen management (landing → editor → library)
- User authentication state
- Model list loading from Supabase
- Event listeners for model updates

#### `VoiceBot.tsx`
- Audio recording (WebM format)
- `/api/transcribe` request handling
- Job polling for async generation
- Automatic model loading and navigation
- Summary generation trigger

#### `sceneSetup.ts` (Three.js)
- Scene initialization (camera, lights, controls)
- STL/GLB model loading
- Event-driven model updates (`vibecad:load-glb`)
- OrbitControls for viewport interaction

### Data Flow

```
User clicks record → WebM chunks → Blob → FormData
                                              ↓
                                    POST /api/transcribe
                                              ↓
                          Job ID + Status Audio (TTS)
                                              ↓
                         Poll /api/generation/job/<id>
                                              ↓
                            SCAD Code Available
                                              ↓
                         POST /convert-scad (Node)
                                              ↓
                          STL URL returned
                                              ↓
               Event: vibecad:load-glb + model-saved
                                              ↓
          Three.js loads STL → Navigate to editor
                                              ↓
                    POST /generate-model-summary
                                              ↓
                Summary TTS plays automatically
```

---

## Technical Details

### Markdown Fence Handling

Problem: LLMs wrap code in markdown fences, causing syntax errors in OpenSCAD.

Solution: Triple-layer defense:

1. **Source Level** (`fin.py`, `testing.py`)
   - Strip fences before writing to `.scad` files
   - Handles multiple fence formats

2. **Backend Level** (`app.py`)
   - `_strip_markdown_fences()` when reading files
   - Safety net for any missed fences

3. **Converter Level** (`server.js`)
   - Line-by-line fence detection
   - Trims whitespace, handles edge cases

### Variable Hoisting

Problem: OpenSCAD variables defined inside modules aren't accessible in assembly code.

Example:
```openscad
module leg() {
  leg_thickness = 40;  // Defined in module
  cube([leg_thickness, leg_thickness, 100]);
}

translate([0, 0, leg_thickness/2])  // ERROR: Undefined variable
  leg();
```

Solution: Node converter detects and hoists:
```javascript
// Auto-hoisted variables from module scopes
leg_thickness = 40;

module leg() {
  cube([leg_thickness, leg_thickness, 100]);
}

translate([0, 0, leg_thickness/2])  // Now works
  leg();
```

### Async Generation with Job Polling

Design choice: HTTP polling instead of WebSockets

Rationale:
- Simpler deployment (no persistent connections)
- Works with serverless/Heroku
- Easier error recovery

Implementation:
```typescript
// Frontend polls every 2.5 seconds
const pollInterval = setInterval(async () => {
  const job = await fetch(`/api/generation/job/${jobId}`);
  if (job.status === 'done') {
    clearInterval(pollInterval);
    loadModel(job.scad_code);
  }
}, 2500);
```

---

## Debugging

### Common Issues

1. Error 1140472 (OpenSCAD Compilation)
- Check Node converter logs for SCAD preview
- Usually: undefined variables or degenerate geometry
- Failed SCAD saved to `backend/nodeserv/public/generated/failed_*.scad`

2. Markdown Fences Persist
- Check Flask console for fence stripping logs
- Verify `_strip_markdown_fences()` is being called
- May need to restart Flask server

3. Model Not Loading in Viewport
- Check browser console for `vibecad:load-glb` event
- Verify STL URL is accessible: `http://localhost:3001/files/generated/model_*.stl`
- Check Three.js loader errors in console

4. Generation Job Stuck
- Check Flask terminal for AttributeError or traceback
- May be Dedalus API issue or LLM rate limiting
- Job status endpoint: `GET /api/generation/job/<id>`

---

## Deployment

### Heroku Setup

```bash
# Procfile (already configured)
web: gunicorn backend.app:app
```

Build Steps:
1. Set environment variables in Heroku dashboard
2. Add buildpacks: Python + Node.js
3. Deploy from GitHub or CLI

Notes:
- Frontend built separately (Vercel/Netlify recommended)
- Node converter runs as part of main process
- Update CORS_ORIGINS for production domain

---

## Technologies

### Backend
- **Flask** - Web framework
- **Dedalus** - Agentic AI orchestration
- **ElevenLabs** - Speech-to-text & TTS
- **Anthropic Claude** - Code generation
- **Supabase** - Database & auth
- **OpenSCAD WASM** - STL compilation

### Frontend
- **Vite** - Build tool
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js** - 3D rendering
- **Tailwind CSS** - Styling

### Infrastructure
- **Node.js Express** - Converter microservice
- **Supabase PostgreSQL** - Data persistence
- **Vite Proxy** - Development routing

---

## API Reference

### `/api/transcribe` (POST)

**Body (multipart/form-data):**
```
file: Audio blob (WebM)
userid: User UUID
modelid: Model UUID (optional, for iteration)
prompt: Fallback prompt if STT fails (optional)
```

**Query Params:**
- `?chain=1` - Enable SCAD generation
- `?async=1` - Return job ID instead of waiting

**Response:**
```json
{
  "text": "transcribed text",
  "intent": "generate" | "iterate",
  "status_audio_b64": "base64 audio",
  "status_audio_format": "mp3",
  "job_id": "uuid",
  "scad_code": "..." // If not async
}
```

### `/convert-scad` (POST)

**Body (JSON):**
```json
{
  "scad": "OpenSCAD code",
  "model_id": "optional-id",
  "userid": "optional-id",
  "stream": false
}
```

**Response:**
```json
{
  "status": "ok",
  "url": "/files/generated/model_123.stl",
  "bytes": 1497,
  "format": "stl",
  "ms": 234
}
```

---

## License

MIT License - See LICENSE file for details

---

## Contributing

Contributions welcome. Please:
1. Fork the repository
2. Create a feature branch
3. Test thoroughly (especially SCAD generation)
4. Submit a pull request

---

## Acknowledgments

- OpenSCAD community for the amazing WASM port
- Dedalus team for agentic orchestration framework
- Anthropic for Claude's excellent code generation
- ElevenLabs for high-quality voice synthesis
