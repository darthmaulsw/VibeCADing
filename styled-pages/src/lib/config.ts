/**
 * Backend API configuration
 * Uses environment variable in production, localhost in development
 */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Debug: Log which backend URL is being used
if (import.meta.env.DEV) {
  console.log('🔧 [Config] Using backend URL:', BACKEND_URL);
  console.log('🔧 [Config] VITE_BACKEND_URL env var:', import.meta.env.VITE_BACKEND_URL || 'NOT SET');
}

export const API_ENDPOINTS = {
  HUNYUAN_GENERATE: `${BACKEND_URL}/api/hunyuan/generate`,
  TRANSCRIBE: `${BACKEND_URL}/api/transcribe`,
  GET_RESPONSE: `${BACKEND_URL}/api/getresponse`,
  HEALTH: `${BACKEND_URL}/api/health`,
} as const;

