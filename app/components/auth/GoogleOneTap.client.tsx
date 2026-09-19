import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { currentUser, loginWithGoogleOneTap } from '~/lib/stores/authStore';
import { trackAuthEvent } from '~/utils/plausible';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          cancel: () => void;
          renderButton?: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}

const DEFAULT_GOOGLE_CLIENT_ID =
  '621528879053-jd08lnt5dnvslt0k5kpsel2n7tiul728.apps.googleusercontent.com';

interface GoogleOneTapProps {
  clientId?: string;
}

export function GoogleOneTap({ clientId = DEFAULT_GOOGLE_CLIENT_ID }: GoogleOneTapProps) {
  const user = useStore(currentUser);
  const initializedRef = useRef(false);

  useEffect(() => {
    // If user is already logged in, do not display One Tap
    if (user) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
      return;
    }

    let isMounted = true;

    function initGoogleOneTap() {
      if (!window.google?.accounts?.id || !isMounted || user) {
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            console.log('[Google One Tap] Received credential token from Google, logging in...');
            if (response?.credential) {
              try {
                await loginWithGoogleOneTap(response.credential);
                trackAuthEvent('sign_in', { method: 'google_one_tap' });
                console.log('[Google One Tap] Successfully authenticated with Google!');
                window.location.reload();
              } catch (err) {
                console.error('[Google One Tap] Login failed:', err);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: false,
          context: 'signin',
          itp_support: true,
        });

        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            console.debug('[Google One Tap] Prompt not displayed:', notification.getNotDisplayedReason());
          } else if (notification.isSkippedMoment()) {
            console.debug('[Google One Tap] Skipped moment:', notification.getSkippedReason());
          } else if (notification.isDismissedMoment()) {
            console.debug('[Google One Tap] Dismissed moment:', notification.getDismissedReason());
          }
        });

        initializedRef.current = true;
      } catch (err) {
        console.warn('[Google One Tap] Initialization warning:', err);
      }
    }

    // Check if Google script already exists in document
    const existingScript = document.getElementById('google-gsi-client');

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted) {
          initGoogleOneTap();
        }
      };
      script.onerror = (e) => {
        console.warn('[Google One Tap] Failed to load Google Identity Services:', e);
      };
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initGoogleOneTap();
    } else {
      existingScript.addEventListener('load', () => {
        if (isMounted) {
          initGoogleOneTap();
        }
      });
    }

    return () => {
      isMounted = false;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [user, clientId]);

  return null;
}
