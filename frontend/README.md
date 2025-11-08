# VibeCADing Frontend

A Vite + React frontend for testing VibeCADing APIs.

## Features

This test interface includes three main API testing sections:

1. **Text-to-Speech (TTS) Test** - Test text-to-speech conversion with audio playback
2. **OpenSCAD Code Generation Test** - Generate OpenSCAD code from natural language descriptions
3. **Gemini Summary Test** - Get AI-powered summaries using Gemini

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Configuration

The Vite config is set up to proxy API requests to `http://localhost:8000`. Make sure your backend server is running on that port, or update the proxy configuration in `vite.config.js`.

### Expected API Endpoints

- `POST /api/tts` - Text-to-speech conversion
- `POST /api/openscad/generate` - OpenSCAD code generation
- `POST /api/gemini/summary` - Gemini AI summaries

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ApiTestPage.jsx      # Main API test interface
│   │   └── ApiTestPage.css      # Styles for test page
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # Entry point
│   └── index.css                # Global styles
├── index.html                   # HTML template
├── vite.config.js              # Vite configuration
└── package.json                # Dependencies
```

## Technologies

- **React 18** - UI library
- **Vite 5** - Build tool and dev server
- **CSS3** - Styling with modern features (dark/light mode support)

