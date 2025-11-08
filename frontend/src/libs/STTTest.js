import record from 'node-record-lpcm16';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const file = fs.createWriteStream('src/libs/mic.wav', { encoding: 'binary' });

const rec = record.record({
  sampleRate: 16000,
  recordProgram: 'rec',
  endOnSilence: true,
  silence: '1.5',
  threshold: '1%'
});

const s = rec.stream();
s.pipe(file);

console.log('Recording... Enter to stop; auto-stops on pause.');
rl.on('line', () => { rec.stop(); rl.close(); });
file.on('close', () => { console.log('Saved mic.wav'); process.exit(0); });