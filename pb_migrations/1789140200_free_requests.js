migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.add(new NumberField({ name: 'daily_free_requests_count', min: 0 }));
  users.fields.add(new TextField({ name: 'free_requests_day', max: 32 }));
  app.save(users);
}, () => {});
