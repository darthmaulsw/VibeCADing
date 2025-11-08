import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import { Readable } from "stream";
import "dotenv/config";

async function bufferToStream(buffer) {
  const elevenlabs = new ElevenLabsClient();
  const audio = await elevenlabs.textToSpeech.convert("mBZBN9sY5XeDDvrbX1OK", {
    text: buffer,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  const reader = audio.getReader();
  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(value);
      }
    },
  });

  return stream;
}

export { bufferToStream };

// // example use DELETE WHEN DONE TESTING
//   const stream = await bufferToStream("11 bombo rasclat egg. ");
//   await play(stream);
