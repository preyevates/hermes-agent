import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { useContributions } from '@/contrib'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { playSpeechText, stopVoicePlayback } from '@/lib/voice-playback'
import { VOICE_TEST_SAMPLE_AREA, type VoiceTestSampleContribution } from '@/lib/voice-test-sample'
import { notifyError } from '@/store/notifications'
import { $voicePlayback } from '@/store/voice-playback'

import { ListRow } from './primitives'

/**
 * Settings → Voice → Speech: speak a sample line through the same path as
 * read-aloud, so the answer to "what will my voice sound like?" does not
 * require starting a conversation.
 *
 * The backend speaks what is SAVED, so `disabled` holds the button while the
 * page's debounced autosave still owes the backend a change.
 */
export function VoiceTestRow({ disabled = false, profile }: { disabled?: boolean; profile?: string }) {
  const { t } = useI18n()
  const c = t.settings.config
  const playback = useStore($voicePlayback)
  const hosted = useContributions(VOICE_TEST_SAMPLE_AREA)
  const text = (hosted[0]?.data as undefined | VoiceTestSampleContribution)?.text?.trim() || c.voiceTestSample
  const mine = playback.source === 'voice-test' && playback.status !== 'idle'
  const preparing = mine && playback.status === 'preparing'
  const busyElsewhere = playback.status !== 'idle' && !mine
  const started = useRef(false)

  // Leaving the page cuts off our own sample, never someone else's playback.
  useEffect(
    () => () => {
      if (started.current && $voicePlayback.get().source === 'voice-test') {
        stopVoicePlayback()
      }
    },
    []
  )

  const speak = async () => {
    started.current = true

    try {
      await playSpeechText(text, { profile, source: 'voice-test' })
    } catch (error) {
      notifyError(error, c.voiceTestFailed)
    }
  }

  return (
    <ListRow
      action={
        <Button
          disabled={preparing || busyElsewhere || (!mine && disabled)}
          onClick={() => {
            triggerHaptic('selection')
            void (mine ? stopVoicePlayback() : speak())
          }}
          size="sm"
          variant="outline"
        >
          {preparing ? c.voiceTestPreparing : mine ? c.voiceTestStop : c.voiceTestButton}
        </Button>
      }
      description={c.voiceTestDesc}
      title={c.voiceTestTitle}
    />
  )
}
