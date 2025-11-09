# SCAD Conversion Service

## Overview
Node.js service that converts OpenSCAD code to STL files using openscad-wasm.

## Running the Service

### Start the server
```bash
cd backend/nodeserv
node server.js
```
Server will start on port **3001** by default.

### Test the endpoint
```bash
node test-convert.js
```

## API Endpoints

### POST /convert-scad
Convert SCAD code to STL format.

**Request:**
```json
{
  "scad": "cube([10, 10, 10]);",
  "model_id": "optional-id",
  "userid": "optional-user",
  "stream": false
}
```

**Response (JSON mode - default):**
```json
{
  "status": "ok",
  "url": "/files/generated/model_1234567890_abc123.stl",
  "bytes": 684,
  "format": "stl",
  "model_id": "optional-id",
  "ms": 245
}
```

**Response (stream mode - stream: true):**
Returns raw STL binary data with `Content-Type: application/sla`

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "scad-converter"
}
```

### GET /files/generated/*
Static file serving for generated STL files.

## Integration with Frontend

### Vite Dev Proxy (frontend/vite.config.js)
```js
proxy: {
  '/convert-scad': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  '/files': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  }
}
```

### VoiceBot Component
The VoiceBot automatically:
1. Records audio and sends to Flask backend
2. Receives status audio and plays it
3. Polls for job completion with SCAD code
4. Posts SCAD to `/convert-scad` endpoint
5. Dispatches `model-saved` event with STL URL
6. 3D viewer automatically loads the STL file

## Architecture Flow

```
User Voice Input
    ↓
VoiceBot → Flask /api/transcribe (STT + async CAD generation)
    ↓
Status Audio Playback (immediate)
    ↓
Poll /api/generation/job/{id} (every 2.5s)
    ↓
Receive SCAD code
    ↓
POST /convert-scad → Node Server (OpenSCAD WASM)
    ↓
Save STL to /files/generated/
    ↓
Return URL → VoiceBot
    ↓
Dispatch 'model-saved' event
    ↓
3D Viewer loads STL (STLLoader) → Replaces cube
```

## File Structure
```
backend/nodeserv/
├── server.js          # Main conversion service
├── test-convert.js    # Test script
├── package.json       # Dependencies
└── public/
    └── generated/     # Generated STL files (auto-created)
```

## Dependencies
- express
- openscad-wasm
- fs, path (built-in)

## Ports
- **3001**: Node conversion service
- **3000**: Vite frontend dev server
- **5000**: Flask backend API

## Notes
- STL files are saved with unique timestamps and random IDs
- CORS is enabled for all origins (adjust for production)
- Files are served statically from `/files/generated/`
- Both JSON and stream modes are supported
- 3D viewer supports both STL and GLB/GLTF formats
