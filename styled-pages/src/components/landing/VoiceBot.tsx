import { useEffect, useState, useRef } from 'react';

type TranscribeEnvelope = {
  status_audio_b64?: string;
  status_audio_format?: string;
  text?: string;
  intent?: 'iterate' | 'generate';
  job_id?: string;
  error?: string;
  scad_code?: string;
  model_id?: string;
};

type VoiceBotProps = {
  endpoint?: string;     // default: /api/transcribe
  userid?: string;       // required for iterate path
  modelid?: string;      // required for iterate path
  promptFallback?: string; // optional: used if transcript is empty
  convertEndpoint?: string; // default: /convert-scad
  onModelReady?: () => void; // callback when model is successfully converted
};

export function VoiceBot({
  endpoint = '/api/transcribe',
  userid,
  modelid,
  promptFallback,
  convertEndpoint = '/convert-scad',
  onModelReady,
}: VoiceBotProps) {
  const [pulseScale, setPulseScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const playingRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<number | null>(null);

  // Start mic capture
  const startRecording = async () => {
    if (isRecording || sending) return;
    try {
      const mime = 'audio/webm;codecs=opus';
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(streamRef.current, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch (e) {
      console.error('[VoiceBot] Failed to start mic:', e);
    }
  };

  // Convert SCAD to STL via Node server and notify editor
  const handleScad = async (scad: string, mid?: string) => {
    try {
      console.log('[VoiceBot] Converting SCAD to STL via', convertEndpoint);
      const resp = await fetch(convertEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scad, model_id: mid, userid }),
      });

      if (!resp.ok) {
        console.warn('[VoiceBot] convert-scad failed:', resp.status);
        return;
      }

      const ct = resp.headers.get('content-type') || '';
      let modelUrl: string | null = null;

      if (ct.includes('application/json')) {
        const json: { url?: string } | null = await resp.json().catch(() => null);
        modelUrl = json?.url || null;
      } else if (ct.includes('application/sla') || ct.includes('model/') || ct.includes('application/octet-stream')) {
        // Raw STL stream - create blob URL
        const blob = await resp.blob();
        modelUrl = URL.createObjectURL(blob);
      }

      if (modelUrl) {
        // Store URL globally and dispatch event for 3D viewer
        (window as unknown as { VIBECAD_LAST_GLB_URL?: string }).VIBECAD_LAST_GLB_URL = modelUrl;
        try {
          localStorage.setItem('last_glb_url', modelUrl);
        } catch (storageErr) {
          console.warn('[VoiceBot] localStorage set failed:', storageErr);
        }
        
        // Dispatch both events:
        // 1. vibecad:load-glb - for the 3D viewer (sceneSetup.ts)
        window.dispatchEvent(new CustomEvent('vibecad:load-glb', { detail: { url: modelUrl } }));
        // 2. model-saved - for App.tsx to reload model list
        window.dispatchEvent(new CustomEvent('model-saved', { detail: { url: modelUrl, model_id: mid, userid } }));
        
        console.log('[VoiceBot] Model ready at', modelUrl);
        
        // Call the callback to navigate to editor
        if (onModelReady) {
          onModelReady();
        }
      }
    } catch (e) {
      console.warn('[VoiceBot] SCAD conversion exception:', e);
    }
  };

  // Poll backend job endpoint until SCAD is ready
  const pollGenerationJob = (jobId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    console.log('[VoiceBot] Polling job:', jobId);
    
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/generation/job/${jobId}`);
        if (!r.ok) return;
        
        const j = await r.json();
        console.log('[VoiceBot] Job status:', j?.status);
        
        if (j?.status === 'done' && j?.scad_code) {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          await handleScad(j.scad_code, j.model_id || modelid);
        } else if (j?.status === 'error') {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          console.warn('[VoiceBot] Generation error:', j?.error);
        }
      } catch (pollErr) {
        console.warn('[VoiceBot] Poll error (transient):', pollErr);
      }
    }, 2500);
  };

  // Stop & send to chained transcription/status + async CAD generation
  const stopAndSend = async () => {
    if (!isRecording || sending) return;
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    setSending(true);

    // stop and wait
    const done = new Promise<void>((resolve) => (mr.onstop = () => resolve()));
    mr.stop();
    await done;

    // cleanup stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);

    // build blob
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      const fd = new FormData();
      fd.append('file', blob, 'clip.webm');
      if (userid) fd.append('userid', userid);
      if (modelid) fd.append('modelid', modelid);

      // Add a fallback prompt if you want server to generate even when STT is empty
      if (promptFallback) fd.append('prompt', promptFallback);

      // chain=1 -> status+generation; async=1 -> return immediately with status audio + job id
      const url = `${endpoint}?chain=1&async=1`;
      const resp = await fetch(url, { method: 'POST', body: fd });

      const ct = resp.headers.get('content-type') || '';
      let data: TranscribeEnvelope | null = null;

      if (ct.includes('application/json')) {
        data = await resp.json().catch(() => null);
      } else {
        const txt = await resp.text();
        console.warn('[VoiceBot] Unexpected response:', ct, txt.slice(0, 200));
      }

      if (!resp.ok) {
        console.warn('[VoiceBot] Backend error:', resp.status, data?.error);
      }

      // Warn if the server decided to iterate but we did not provide a model id
      if (data?.intent === 'iterate' && !modelid) {
        console.warn('[VoiceBot] Iteration requested, but no modelid was provided.');
      }

      // Play status audio immediately
      const b64 = data?.status_audio_b64;
      const fmt = (data?.status_audio_format || 'mp3').toLowerCase();
      if (b64) {
        try {
          const clean = b64.replace(/\s/g, '');
          const bin = atob(clean);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const mime = fmt === 'mp3' ? 'audio/mpeg' : `audio/${fmt}`;
          const url = URL.createObjectURL(new Blob([bytes], { type: mime }));

          // stop any currently playing status
          try {
            playingRef.current?.pause();
            playingRef.current?.removeAttribute('src');
          } catch (pauseErr) {
            // Ignore pause errors
            console.warn('[VoiceBot] Failed to stop previous audio:', pauseErr);
          }

          const a = new Audio(url);
          playingRef.current = a;
          a.onended = () => URL.revokeObjectURL(url);
          a.play().catch((playErr) => {
            console.warn('[VoiceBot] Autoplay blocked or failed:', playErr);
          });
        } catch (e) {
          console.warn('[VoiceBot] Failed to decode or play status audio', e);
        }
      }

      // If SCAD arrived synchronously, convert right away; else poll for job
      if (data?.scad_code) {
        await handleScad(data.scad_code, data.model_id || modelid);
      } else if (data?.job_id) {
        pollGenerationJob(data.job_id);
      }
    } catch (e) {
      console.error('[VoiceBot] Network error:', e);
    } finally {
      setSending(false);
    }
  };

  // Toggle handler (single click region)
  const handleToggle = () => {
    if (sending) return;
    if (!isRecording) startRecording(); else stopAndSend();
  };

  // visuals
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseScale((prev) => {
        const newScale = prev + 0.05;
        return newScale > 1.3 ? 1 : newScale;
      });
    }, 50);
    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    const rotateInterval = setInterval(() => {
      setRotation((r) => (r + 1) % 360);
    }, 30);
    return () => clearInterval(rotateInterval);
  }, []);

  useEffect(() => {
    // Cleanup polling interval on unmount
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div
      className="absolute bottom-32 left-6"
      role="button"
      aria-label={isRecording ? 'Stop & generate' : 'Start voice capture'}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      style={{ cursor: sending ? 'not-allowed' : 'pointer' }}
    >
      <svg width="120" height="120" className="absolute bottom-0 left-0">
        <circle cx="60" cy="60" r="2" fill="#00D4FF" opacity="0.8" />
        <line x1="60" y1="60" x2="60" y2="0" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
        <line x1="60" y1="60" x2="0" y2="60" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
      </svg>

      <div className="relative w-20 h-20 ml-5 mb-5">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          className="absolute inset-0"
          style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
        >
          <circle cx="40" cy="40" r="35" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.2" strokeDasharray="4 4" />
          <circle cx="40" cy="40" r="28" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
          <circle cx="40" cy="40" r="20" fill="none" stroke="#00D4FF" strokeWidth="1.5" opacity="0.5" />
          {[0,45,90,135,180,225,270,315].map((angle) => (
            <line key={angle}
              x1="40" y1="40"
              x2={40 + Math.cos((angle*Math.PI)/180)*35}
              y2={40 + Math.sin((angle*Math.PI)/180)*35}
              stroke="#00D4FF" strokeWidth="0.5" opacity="0.2"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scale(${pulseScale})`, transition: 'transform 50ms linear' }}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="15" fill="rgba(130, 209, 255, 0.2)" />
            <circle cx="20" cy="20" r="12" fill="none" stroke="#00D4FF" strokeWidth="2" opacity="0.6" />
            <circle cx="20" cy="20" r="6" fill="#00D4FF" opacity="0.8" />
          </svg>
        </div>

        <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0" style={{ transform: `rotate(${-rotation * 1.5}deg)`, transformOrigin: 'center' }}>
          {[0,120,240].map((angle) => {
            const x = 40 + Math.cos((angle*Math.PI)/180)*30;
            const y = 40 + Math.sin((angle*Math.PI)/180)*30;
            return <circle key={angle} cx={x} cy={y} r="2" fill="#00D4FF" opacity="0.6" />;
          })}
        </svg>
      </div>

      <div className="font-mono text-[9px] opacity-50 tracking-widest text-center mt-2" style={{ color: '#00D4FF' }}>
        {sending ? 'UPLOADING' : isRecording ? 'LISTENING' : 'CLICK TO SPEAK'}
      </div>

      <div className="flex items-center justify-center gap-1 mt-1">
        {[0,1,2].map((i) => (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: isRecording ? `${8 + Math.sin(Date.now()/100 + i) * 4}px` : '4px',
              background: '#00D4FF', opacity: 0.6, transition: 'height 100ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}
