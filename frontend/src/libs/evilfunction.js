// Runner to transcribe existing mic.wav filtering to speaker_0 using shared STT module
import { transcribe } from './STT.js';

const { text } = await transcribe('src/libs/mic.wav', { speakerFilter: 'speaker_0' });
if (text) console.log(text);