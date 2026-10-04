import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'
import { en } from '@/i18n/en'
import { VOICE_TEST_SAMPLE_AREA } from '@/lib/voice-test-sample'
import { setVoicePlaybackState } from '@/store/voice-playback'

import { VoiceTestRow } from './voice-test-row'

const speech = vi.hoisted(() => ({
  playSpeechText: vi.fn(),
  stopVoicePlayback: vi.fn()
}))

const errors = vi.hoisted(() => vi.fn())

vi.mock('@/lib/voice-playback', () => speech)
vi.mock('@/store/notifications', () => ({ notifyError: errors }))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))

const c = en.settings.config
const disposers: Array<() => void> = []

const idle = { audioElement: null, messageId: null, sequence: 0, source: null, status: 'idle' } as const

beforeEach(() => {
  speech.playSpeechText.mockResolvedValue(true)
  setVoicePlaybackState(idle)
})

afterEach(() => {
  cleanup()
  disposers.splice(0).forEach(dispose => dispose())
  vi.clearAllMocks()
  setVoicePlaybackState(idle)
})

const button = (name: string) => screen.getByRole('button', { name })

describe('VoiceTestRow', () => {
  it('speaks the default line for the scoped profile, as its own playback source', async () => {
    render(<VoiceTestRow profile="nash" />)

    fireEvent.click(button(c.voiceTestButton))

    await waitFor(() => expect(speech.playSpeechText).toHaveBeenCalledTimes(1))
    expect(speech.playSpeechText).toHaveBeenCalledWith(c.voiceTestSample, { profile: 'nash', source: 'voice-test' })
  })

  it('speaks the host-supplied line instead, and the lowest order wins', async () => {
    act(() => {
      disposers.push(
        registry.registerMany([
          { area: VOICE_TEST_SAMPLE_AREA, data: { text: 'Second host line' }, id: 'b', order: 2 },
          { area: VOICE_TEST_SAMPLE_AREA, data: { text: '  First host line  ' }, id: 'a', order: 1 }
        ])
      )
    })

    render(<VoiceTestRow />)
    fireEvent.click(button(c.voiceTestButton))

    await waitFor(() => expect(speech.playSpeechText).toHaveBeenCalled())
    expect(speech.playSpeechText.mock.calls[0][0]).toBe('First host line')
  })

  it('falls back to the default line when the host line is blank', async () => {
    act(() => {
      disposers.push(registry.register({ area: VOICE_TEST_SAMPLE_AREA, data: { text: '   ' }, id: 'blank' }))
    })

    render(<VoiceTestRow />)
    fireEvent.click(button(c.voiceTestButton))

    await waitFor(() => expect(speech.playSpeechText).toHaveBeenCalled())
    expect(speech.playSpeechText.mock.calls[0][0]).toBe(c.voiceTestSample)
  })

  it('waits while a setting change is still unsaved, since the backend speaks what is saved', () => {
    const { rerender } = render(<VoiceTestRow disabled />)

    expect(button(c.voiceTestButton).hasAttribute('disabled')).toBe(true)
    rerender(<VoiceTestRow />)
    expect(button(c.voiceTestButton).hasAttribute('disabled')).toBe(false)
  })

  it('does not talk over read-aloud or a voice conversation', () => {
    setVoicePlaybackState({ ...idle, messageId: 'm1', source: 'read-aloud', status: 'speaking' })
    render(<VoiceTestRow />)

    expect(button(c.voiceTestButton).hasAttribute('disabled')).toBe(true)
  })

  it('shows Preparing while audio is on its way, then Stop while it plays, and Stop cuts it off', () => {
    render(<VoiceTestRow />)

    act(() => setVoicePlaybackState({ ...idle, source: 'voice-test', status: 'preparing' }))
    expect(button(c.voiceTestPreparing).hasAttribute('disabled')).toBe(true)

    act(() => setVoicePlaybackState({ ...idle, source: 'voice-test', status: 'speaking' }))
    fireEvent.click(button(c.voiceTestStop))
    expect(speech.stopVoicePlayback).toHaveBeenCalledTimes(1)
    expect(speech.playSpeechText).not.toHaveBeenCalled()
  })

  it('reports a synthesis failure and leaves the button usable', async () => {
    const failure = new Error('no audio')
    speech.playSpeechText.mockRejectedValue(failure)
    render(<VoiceTestRow />)

    fireEvent.click(button(c.voiceTestButton))

    await waitFor(() => expect(errors).toHaveBeenCalledWith(failure, c.voiceTestFailed))
    expect(button(c.voiceTestButton).hasAttribute('disabled')).toBe(false)
  })

  it('cuts off its own sample when the page closes, never somebody else’s playback', async () => {
    const first = render(<VoiceTestRow />)

    fireEvent.click(button(c.voiceTestButton))
    await waitFor(() => expect(speech.playSpeechText).toHaveBeenCalled())
    act(() => setVoicePlaybackState({ ...idle, source: 'voice-test', status: 'speaking' }))
    first.unmount()
    expect(speech.stopVoicePlayback).toHaveBeenCalledTimes(1)

    speech.stopVoicePlayback.mockClear()
    const second = render(<VoiceTestRow />)

    act(() => setVoicePlaybackState({ ...idle, messageId: 'm1', source: 'read-aloud', status: 'speaking' }))
    second.unmount()
    expect(speech.stopVoicePlayback).not.toHaveBeenCalled()
  })
})
