import React from "react";
import { useMediaRecorderWithSilence } from "./recorder.ts";

export default function MediaButton() {
  const { start, isRecording } = useMediaRecorderWithSilence({ audio: true });

  return (
    <button onClick={() => start()}>
      {isRecording ? "Recording… (auto-stops on silence)" : "Start Recording"}
    </button>
  );
}
