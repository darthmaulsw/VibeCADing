import { useRef, useState } from "react";

export function useMediaRecorderWithSilence(
  constraints: MediaStreamConstraints = { audio: true },
  silenceThreshold = 0.01,   // lower = more sensitive
  silenceDurationMs = 2000   // how long of silence before stopping
) {
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimer = useRef<number | null>(null);

  async function start() {
    streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    recRef.current = new MediaRecorder(streamRef.current, {
      mimeType: "audio/webm;codecs=opus",
    });
    chunksRef.current = [];
    recRef.current.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);

    // Start recording
    recRef.current.start();
    setIsRecording(true);

    // Setup audio monitoring
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(streamRef.current);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Float32Array(analyser.fftSize);

    function monitor() {
      analyser.getFloatTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
      const rms = Math.sqrt(sumSquares / data.length);

      // if below threshold for too long, stop recording
      if (rms < silenceThreshold) {
        if (silenceTimer.current === null) {
          silenceTimer.current = window.setTimeout(() => stop(), silenceDurationMs);
        }
      } else if (silenceTimer.current !== null) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }

      if (recRef.current && recRef.current.state === "recording") {
        requestAnimationFrame(monitor);
      }
    }
    monitor();
  }

  async function stop(filename = "auto-stop.webm") {
    if (!recRef.current) return;
    const rec = recRef.current;
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.stop();
    await done;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    setIsRecording(false);

    const blob = new Blob(chunksRef.current, { type: rec.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // reset
    chunksRef.current = [];
    recRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (silenceTimer.current !== null) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  }

  return { start, stop, isRecording };
}
