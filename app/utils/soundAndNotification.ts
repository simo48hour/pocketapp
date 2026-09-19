/**
 * Sound and Notification Utility for AI generation completion.
 * Uses Web Audio API to synthesize a pleasant harmonic chime without external audio files,
 * and integrates with the HTML5 Notification API for desktop notifications.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch (err) {
    console.warn('[Sound] AudioContext not available:', err);
    return null;
  }
}

/**
 * Plays a pleasant two-tone completion chime (E5 -> A5)
 */
export function playCompletionSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz) - bright, friendly opening tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);

    // Note 2: A5 (880.00 Hz) - uplifting fourth higher
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.1);

    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[Sound] Error playing completion chime:', err);
  }
}

/**
 * Request notification permission upon user interaction (e.g. sending a message).
 */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (err) {
    console.warn('[Notification] Could not request permission:', err);
  }
}

let lastNotificationTime = 0;

/**
 * Triggers sound and native desktop notification when AI finishes.
 * Automatically throttles within 3 seconds to avoid duplicate sounds.
 */
export function triggerCompletionNotification(
  title = 'PocketApp',
  body = 'AI generation is complete!',
): void {
  const now = Date.now();
  if (now - lastNotificationTime < 3000) {
    return;
  }
  lastNotificationTime = now;

  playCompletionSound();

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'pocketapp-ai-finished',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.warn('[Notification] Error showing notification:', err);
    }
  }
}
