/**
 * VOICE TEST SAMPLE — what Settings → Voice → Speech says when "Test voice" is pressed.
 *
 * Core owns a default line (`settings.config.voiceTestSample`). A host that
 * wants to be heard saying something of its own (a welcome line, a poem, the
 * user's language) registers one `data` contribution here; the lowest `order`
 * wins, and the default stands when nothing is registered.
 */

export const VOICE_TEST_SAMPLE_AREA = 'settings.voice.testSample'

/** Payload of a `settings.voice.testSample` contribution's `data`. */
export interface VoiceTestSampleContribution {
  /** The text to speak. Plain text; it goes through the same sanitizer as read-aloud. */
  text: string
}
