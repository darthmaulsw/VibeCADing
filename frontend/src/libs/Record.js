import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';
import fs from 'fs/promises';

const elevenlabs = new ElevenLabsClient();
const wavBuffer = await fs.readFile('src/libs/mic.wav');
const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });

const t = await elevenlabs.speechToText.convert({
  file: audioBlob,
  modelId: 'scribe_v1',
  tagAudioEvents: true,
  languageCode: 'eng',
  diarize: true,
});

let speaker0 = '';

if (t.utterances?.length) {
  speaker0 = t.utterances
    .filter(u => (u.speakerId ?? u.speaker ?? t.speakerId) === 'speaker_0')
    .map(u => u.text)
    .join(' ')
    .trim();
} else if (t.words?.length) {
  if (t.speakerId === 'speaker_0') {
    speaker0 = t.text?.trim() ?? '';
  } else {
    const parts = [];
    for (const w of t.words) {
      const sp = w.speakerId ?? w.speaker ?? t.speakerId;
      if (sp === 'speaker_0') parts.push(w.text);
    }
    speaker0 = parts.join('').replace(/\s+([.,!?;:])/g, '$1').trim();
  }
} else if (t.speakerId === 'speaker_0') {
  speaker0 = (t.text ?? '').trim();
}

if (speaker0) console.log(speaker0);