migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const collection = new Collection({
    name: 'custom_domains',
    type: 'base',
    listRule: "@request.auth.id != '' && @request.auth.id = user.id",
    viewRule: "@request.auth.id != '' && @request.auth.id = user.id",
    fields: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: 'domain', type: 'text', required: true },
      { name: 'project_id', type: 'text', required: true },
      { name: 'target', type: 'text', required: true },
      { name: 'status', type: 'text', required: true },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_custom_domain ON custom_domains (domain)'],
  });
  app.save(collection);
}, () => {});
