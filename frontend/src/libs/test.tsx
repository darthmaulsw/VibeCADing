"use client";
import React, { useEffect, useRef, useState } from "react";

/* -------------------- Types -------------------- */
type TranscribeResponse = {
  text?: string;
  raw?: unknown;
  error?: string;

  // status sentence + TTS from backend (immediate)
  status_text?: string;
  status_audio_b64?: string;
  status_audio_format?: string; // e.g., "mp3"

  // legacy audio keys (other endpoints)
  audio_b64?: string;
  audio_format?: string;

  // CAD chaining info
  model_id?: string | null;
  scad_code?: string | null;
  chained_generation?: boolean;

  // async job (present when chain=1 & async=1)
  job_id?: string;
  async?: boolean;
};

type GenerationJob = {
  status: "pending" | "running" | "done" | "error";
  prompt?: string;
  userid?: string | null;
  modelid?: string | null;
  scad_code?: string | null;
  model_id?: string | null;
  error?: string | null;
  trace?: string | null;
};

/* -------------------- Media hook -------------------- */
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

/* -------------------- Fetch helpers -------------------- */
async function postToTranscribe(opts: {
  blob: Blob;
  endpoint?: string;
  filename?: string;
  chain?: boolean;
  asyncGenerate?: boolean;
  // optional: user / model ids to pass through to backend (if you want to persist CAD)
  userid?: string;
  modelid?: string;
}): Promise<TranscribeResponse> {
  const {
    blob,
    endpoint = "/api/transcribe",
    filename = "recording.webm",
    chain = true,
    asyncGenerate = true,
    userid,
    modelid,
  } = opts;

  const fd = new FormData();
  fd.append("file", blob, filename);
  if (userid) fd.append("userid", userid);
  if (modelid) fd.append("modelid", modelid);

  // Build query string so the Flask code reads args easily
  const params = new URLSearchParams();
  if (chain) params.set("chain", "1");
  if (asyncGenerate && chain) params.set("async", "1");
  const url = params.toString() ? `${endpoint}?${params}` : endpoint;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: fd });
  } catch (e: any) {
    throw new Error(`Network error contacting backend: ${e?.message || e}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Unexpected response type (${ct || "unknown"}): ${text.slice(0, 200)}`);
  }

  let data: TranscribeResponse = {};
  try {
    data = (await res.json()) as TranscribeResponse;
  } catch {
    throw new Error("Failed to parse JSON from backend response.");
  }

  if (!res.ok) {
    throw new Error(data?.error || `Transcribe failed: HTTP ${res.status}`);
  }

  return data;
}

async function fetchJob(endpointBase = "/api/generation/job", jobId: string): Promise<GenerationJob> {
  const res = await fetch(`${endpointBase}/${jobId}`, { method: "GET" });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Unexpected response (${ct}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as GenerationJob;
  if (!res.ok) throw new Error(data?.error || `Job fetch failed: HTTP ${res.status}`);
  return data;
}

/* -------------------- Small util -------------------- */
function base64ToBlobUrl(b64: string, mime = "audio/mpeg") {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/* -------------------- Component -------------------- */
type MicToFlaskProps = {
  endpoint?: string;           // Flask /api/transcribe
  filename?: string;           // uploaded filename
  mimeTypeHint?: string;       // e.g. "audio/webm;codecs=opus"
  chain?: boolean;             // ask server to prepare CAD
  asyncGenerate?: boolean;     // return immediately (with status audio + job_id)
  autoplay?: boolean;          // try to autoplay status audio
  pollJobs?: boolean;          // if true, poll the job_id the server returns
  userid?: string;             // optional: passed through to backend
  modelid?: string;            // optional: passed through to backend
};

export default function MicToFlask({
  endpoint = "/api/transcribe",
  filename = "clip.webm",
  mimeTypeHint = "audio/webm;codecs=opus",
  chain = true,
  asyncGenerate = true,   // <-- key change: request immediate return
  autoplay = true,
  pollJobs = true,
  userid,
  modelid,
}: MicToFlaskProps) {
  const { start, stop, isRecording } = useMediaRecorder({ audio: true });
  const audioRef = useRef<HTMLAudioElement>(null);

  const [transcript, setTranscript] = useState("");
  const [statusText, setStatusText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Optional: poll the job until done/error
  useEffect(() => {
    if (!pollJobs || !jobId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const data = await fetchJob("/api/generation/job", jobId);
        if (cancelled) return;
        setJobStatus(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(interval);
        }
      } catch (e) {
        console.warn("Job poll error:", e);
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollJobs, jobId]);

  const handleClick = async () => {
    try {
      setError("");
      if (!isRecording) {
        setTranscript("");
        setStatusText("");
        setAudioUrl("");
        setJobId(null);
        setJobStatus(null);
        await start(mimeTypeHint);
      } else {
        setLoading(true);
        const blob = await stop();
        if (!blob) throw new Error("No audio captured.");

        const resp = await postToTranscribe({
          blob,
          endpoint,
          filename,
          chain,
          asyncGenerate,
          userid,
          modelid,
        });

        // text + status
        setTranscript(resp.text || "");
        setStatusText(resp.status_text || "");

        // immediate status audio (should be present when async=1 & chain=1)
        const b64 = resp.status_audio_b64 || resp.audio_b64;
        const fmt = (resp.status_audio_format || resp.audio_format || "mp3").toLowerCase();
        if (b64) {
          const mime = fmt === "mp3" ? "audio/mpeg" : `audio/${fmt}`;
          const url = base64ToBlobUrl(b64, mime);
          setAudioUrl(url);
          if (autoplay && audioRef.current) {
            try {
              await audioRef.current.play();
            } catch {
              /* autoplay might be blocked; controls are visible */
            }
          }
        } else {
          setAudioUrl("");
        }

        // record job id if present
        setJobId(resp.job_id || null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <button onClick={handleClick} disabled={loading}>
        {isRecording ? "Stop & Transcribe" : "Start Recording"}
      </button>

      {loading && <div>Transcribing…</div>}
      {error && <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</div>}

      {transcript && <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>Transcript: {transcript}</pre>}
      {statusText && <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>Status: {statusText}</pre>}

      <audio ref={audioRef} controls src={audioUrl || undefined} style={{ width: "100%" }} />

      {jobId && (
        <div style={{ fontSize: 13, color: "#555" }}>
          Job: <code>{jobId}</code>{" "}
          <span>
            {jobStatus ? `(${jobStatus.status})` : "(waiting...)"}
          </span>
          {jobStatus?.status === "done" && (
            <div style={{ marginTop: 6 }}>
              {jobStatus.scad_code ? (
                <details>
                  <summary>SCAD code</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{jobStatus.scad_code}</pre>
                </details>
              ) : (
                <span>Done.</span>
              )}
            </div>
          )}
          {jobStatus?.status === "error" && (
            <div style={{ color: "crimson", marginTop: 6 }}>
              Error: {jobStatus.error}
            </div>
          )}
        </div>
      )}

      {!audioUrl && chain && asyncGenerate && (
        <small style={{ color: "#777" }}>
          If you don’t hear audio instantly, check that your server logged a non-empty <code>status_audio_b64</code>.
        </small>
      )}
    </div>
  );
}
