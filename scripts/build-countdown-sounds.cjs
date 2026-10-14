const fs = require('fs'), path = require('path');
const sampleRate = 44100;

function makeTone(frequency, duration) {
  const samples = Math.round(sampleRate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const time = i / sampleRate;
    // A soft attack and decaying tail keep the cue short and avoid clicks.
    const attack = Math.min(1, time / .006);
    const release = Math.min(1, (duration - time) / .02);
    const envelope = attack * release * Math.exp(-time * 8);
    wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * time) * envelope * .4 * 32767), 44 + i * 2);
  }
  return wav;
}

const folder = path.resolve(__dirname, '../se');
fs.writeFileSync(path.join(folder, 'countdown.wav'), makeTone(261.6255653005986, .16));
fs.writeFileSync(path.join(folder, 'countdown-start.wav'), makeTone(523.2511306011972, .24));
console.log('Generated C4 (261.63 Hz) and C5 (523.25 Hz) countdown cues');
