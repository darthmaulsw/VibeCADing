// Minimal hook: start/stop and return Blob (WebM/Opus in most browsers)
import { useRef, useState } from "react";

export function useMediaRecorder(constraints: MediaStreamConstraints = { audio: true }) {
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (mime = "audio/webm;codecs=opus") => {
    streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    recRef.current = new MediaRecorder(streamRef.current, { mimeType: mime });
    chunksRef.current = [];
    recRef.current.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    recRef.current.start();
    setIsRecording(true);
  };

  const stop = async (): Promise<Blob | null> => {
    if (!recRef.current) return null;
    const rec = recRef.current;
    const stopped = new Promise<void>(resolve => (rec.onstop = () => resolve()));
    rec.stop();
    await stopped;
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
    recRef.current = null; chunksRef.current = []; streamRef.current = null;
    return blob;
  };

  return { start, stop, isRecording };
}
