import { describe, it, expect } from 'vitest'
import { buildWav, computeRms } from '@/lib/voice/utils'

describe('buildWav', () => {
  it('writes RIFF/WAVE headers', () => {
    const samples = new Int16Array([100, -200, 300])
    const buf = buildWav(samples, 16000)
    expect(buf.slice(0, 4).toString('ascii')).toBe('RIFF')
    expect(buf.slice(8, 12).toString('ascii')).toBe('WAVE')
    expect(buf.slice(12, 16).toString('ascii')).toBe('fmt ')
    expect(buf.slice(36, 40).toString('ascii')).toBe('data')
  })

  it('encodes sample rate correctly', () => {
    const buf = buildWav(new Int16Array(10), 16000)
    expect(buf.readUInt32LE(24)).toBe(16000)
  })

  it('has correct total length', () => {
    const samples = new Int16Array(100)
    const buf = buildWav(samples, 16000)
    expect(buf.length).toBe(44 + 100 * 2)
  })

  it('writes sample data after header', () => {
    const samples = new Int16Array([1, -1])
    const buf = buildWav(samples, 16000)
    expect(buf.readInt16LE(44)).toBe(1)
    expect(buf.readInt16LE(46)).toBe(-1)
  })
})

describe('computeRms', () => {
  it('returns 0 for silence', () => {
    expect(computeRms(new Int16Array(512))).toBe(0)
  })

  it('returns correct RMS for constant signal', () => {
    const frame = new Int16Array(4).fill(1000)
    expect(computeRms(frame)).toBeCloseTo(1000)
  })

  it('returns value above threshold for loud signal', () => {
    const loud = new Int16Array(512).fill(2000)
    expect(computeRms(loud)).toBeGreaterThan(500)
  })

  it('returns value below threshold for near-silence', () => {
    const quiet = new Int16Array(512).fill(100)
    expect(computeRms(quiet)).toBeLessThan(500)
  })
})
