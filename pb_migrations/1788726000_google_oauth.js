migrate((app) => {
  try {
    const users = app.findCollectionByNameOrId('users');
    if (!users) return;

    // Ensure mappedFields has avatar and name
    users.oauth2 = users.oauth2 || {};
    users.oauth2.mappedFields = users.oauth2.mappedFields || {};
    users.oauth2.mappedFields.name = 'name';
    users.oauth2.mappedFields.avatarURL = 'avatar';

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (googleClientId && googleClientSecret) {
      users.oauth2.enabled = true;
      let providers = users.oauth2.providers || [];
      providers = providers.filter((p) => p.name !== 'google');
      providers.push({
        name: 'google',
        clientId: googleClientId.trim(),
        clientSecret: googleClientSecret.trim(),
        displayName: 'Google',
      });
      users.oauth2.providers = providers;
    }

    app.save(users);
  } catch (err) {
    console.warn('[Migration 1788726000_google_oauth] skipped or failed:', err);
  }
}, (app) => {
  // rollback
});
