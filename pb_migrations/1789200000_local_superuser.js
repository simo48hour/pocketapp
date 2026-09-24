migrate((app) => {
  try {
    const existing = app.findAuthRecordByEmail('_superusers', 'manager@pocketapp.internal');
    if (existing) return;
  } catch {}

  try {
    const superusers = app.findCollectionByNameOrId('_superusers');
    if (!superusers) return;

    const record = new Record(superusers);
    record.set('email', 'manager@pocketapp.internal');
    record.set('password', 'pocketapp-local-db-pass');
    app.save(record);
  } catch (err) {
    // Ignore if already created
  }
}, () => {});
