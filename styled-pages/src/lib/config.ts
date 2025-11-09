/**
 * Backend API configuration
 * Uses environment variable in production, localhost in development
 */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  HUNYUAN_GENERATE: `${BACKEND_URL}/api/hunyuan/generate`,
  TRANSCRIBE: `${BACKEND_URL}/api/transcribe`,
  GET_RESPONSE: `${BACKEND_URL}/api/getresponse`,
  HEALTH: `${BACKEND_URL}/api/health`,
} as const;

