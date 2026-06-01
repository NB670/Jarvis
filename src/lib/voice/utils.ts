export function buildWav(samples: Int16Array, sampleRate = 16000): Buffer {
  const numSamples = samples.length
  const buf = Buffer.alloc(44 + numSamples * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + numSamples * 2, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)              // PCM format
  buf.writeUInt16LE(1, 22)              // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate (16-bit mono)
  buf.writeUInt16LE(2, 32)              // block align
  buf.writeUInt16LE(16, 34)             // bits per sample
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(numSamples * 2, 40)
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2)
  }
  return buf
}

export function computeRms(frame: Int16Array): number {
  if (frame.length === 0) return 0
  const sumSq = frame.reduce((acc, s) => acc + s * s, 0)
  return Math.sqrt(sumSq / frame.length)
}
