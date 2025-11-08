// Record mic to wav and (optionally) transcribe using the reusable stt module.
import record from 'node-record-lpcm16';
import fs from 'fs';
import readline from 'readline';
import { transcribe } from './STT.js';

export function recordToFile(outPath = 'src/libs/mic.wav', opts = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const file = fs.createWriteStream(outPath, { encoding: 'binary' });
  const rec = record.record({
    sampleRate: 16000,
    recordProgram: 'rec',
    endOnSilence: true,
    silence: '1.5',
    threshold: '1%'
  });
  rec.stream().pipe(file);
  console.log(`Recording... Enter to stop; auto-stops on pause. -> ${outPath}`);
  rl.on('line', () => { rec.stop(); rl.close(); });
  return new Promise((resolve) => file.on('close', () => resolve(outPath)));
}

// CLI: record then transcribe speaker_0 (or all if not provided)
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'src/libs/mic.wav';
  const speaker = process.argv[3];
  const doTranscribe = (process.argv[4] ?? 'true').toLowerCase() !== 'false';
  recordToFile(out).then(async (wavPath) => {
    if (!doTranscribe) { console.log('Saved:', wavPath); process.exit(0); }
    const { text } = await transcribe(wavPath, { speakerFilter: speaker });
    console.log(text);
  });
}