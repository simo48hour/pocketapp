// PocketBase Hook to ensure a default local superuser exists
// for local open-source development and WebContainer preview database proxying.

onBootstrap((e) => {
  e.next();

  try {
    const superusers = $app.findCollectionByNameOrId('_superusers');
    if (!superusers) return;

    try {
      $app.findAuthRecordByEmail('_superusers', 'manager@pocketapp.internal');
    } catch {
      const record = new Record(superusers);
      record.set('email', 'manager@pocketapp.internal');
      record.set('password', 'pocketapp-local-db-pass');
      $app.save(record);
      console.log('[Superuser Hook] Default internal local superuser initialized.');
    }
  } catch (err) {
    // Ignore if already created or table locked
  }
});
