// PocketBase Hook to dynamically enable Google OAuth2 provider
// when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.

onBootstrap((e) => {
  e.next();

  try {
    const googleClientId = $os.getenv('GOOGLE_CLIENT_ID');
    const googleClientSecret = $os.getenv('GOOGLE_CLIENT_SECRET');

    if (!googleClientId || !googleClientSecret) {
      // Not configured via environment variables; keep existing settings
      return;
    }

    const cleanClientId = googleClientId.trim();
    const cleanClientSecret = googleClientSecret.trim();

    if (!cleanClientId || !cleanClientSecret) {
      return;
    }

    const users = $app.findCollectionByNameOrId('users');
    if (!users) {
      console.warn('[Google OAuth Hook] users collection not found.');
      return;
    }

    // Ensure oauth2 is enabled
    users.oauth2 = users.oauth2 || {
      providers: [],
      mappedFields: {
        id: '',
        name: 'name',
        username: '',
        avatarURL: 'avatar',
      },
      enabled: true,
    };

    users.oauth2.enabled = true;

    // Filter out previous google provider if already defined
    const providers = (users.oauth2.providers || []).filter((p) => p.name !== 'google');

    providers.push({
      name: 'google',
      clientId: cleanClientId,
      clientSecret: cleanClientSecret,
      displayName: 'Google',
      authURL: '',
      tokenURL: '',
      userInfoURL: '',
      pkce: null,
    });

    users.oauth2.providers = providers;

    $app.save(users);
    console.log('[Google OAuth Hook] Successfully registered & updated Google OAuth2 provider.');
  } catch (err) {
    console.error('[Google OAuth Hook] Failed to configure Google OAuth:', err);
  }
});
