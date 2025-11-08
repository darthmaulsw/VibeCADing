"use client";
import React, { useRef, useState } from "react";

type TranscribeResponse = { text?: string; raw?: unknown; error?: string };

/* -------------------- Hook + Helper in one file -------------------- */
function useMediaRecorder(constraints: MediaStreamConstraints = { audio: true }) {
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (mime = "audio/webm;codecs=opus") => {
    streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    recRef.current = new MediaRecorder(streamRef.current, { mimeType: mime });
    chunksRef.current = [];
    recRef.current.ondataavailable = (e) => e.data.size && chunksRef.current!.push(e.data);
    recRef.current.start();
    setIsRecording(true);
  };

  const stop = async (): Promise<Blob | null> => {
    const rec = recRef.current;
    if (!rec) return null;
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.stop();
    await done;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);

    const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });

    // reset
    recRef.current = null;
    chunksRef.current = [];
    streamRef.current = null;

    return blob;
  };

  return { start, stop, isRecording };
}

async function postToTranscribe(
  blob: Blob,
  endpoint = "/api/transcribe",
  filename = "recording.webm"
): Promise<TranscribeResponse> {
  const fd = new FormData();
  fd.append("file", blob, filename);
  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", body: fd });
  } catch (e: any) {
    // Network / connection refused
    throw new Error(`Network error contacting backend: ${e?.message || e}`);
  }
  let data: TranscribeResponse = {};
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      data = (await res.json()) as TranscribeResponse;
    } catch {
      throw new Error("Failed to parse JSON from backend response.");
    }
  } else {
    // Non-JSON (likely HTML error page from proxy)
    const text = await res.text();
    throw new Error(`Unexpected response type (${ct || 'unknown'}): ${text.slice(0,200)}`);
  }
  if (!res.ok) {
    throw new Error(data?.error || `Transcribe failed: HTTP ${res.status}`);
  }
  return data;
}

/* -------------------- Component -------------------- */
type MicToFlaskProps = {
  endpoint?: string;          // Flask endpoint (default /api/transcribe)
  filename?: string;          // uploaded filename
  mimeTypeHint?: string;      // e.g. "audio/webm;codecs=opus"
};

export default function MicToFlask({
  endpoint = "/api/transcribe",
  filename = "clip.webm",
  mimeTypeHint = "audio/webm;codecs=opus",
}: MicToFlaskProps) {
  const { start, stop, isRecording } = useMediaRecorder({ audio: true });
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    try {
      setError("");
      if (!isRecording) {
        setTranscript("");
        await start(mimeTypeHint);
      } else {
        setLoading(true);
        const blob = await stop();
        if (!blob) throw new Error("No audio captured.");
        const { text } = await postToTranscribe(blob, endpoint, filename);
        setTranscript(text || "");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <button onClick={handleClick} disabled={loading}>
        {isRecording ? "Stop & Transcribe" : "Start Recording"}
      </button>

      {loading && <div>Transcribing…</div>}
      {error && <div style={{ color: "crimson" }}>Error: {error}</div>}
      {transcript && <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{transcript}</pre>}
    </div>
  );
}
