migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const deploymentsCollection = new Collection({
    name: "deployments",
    type: "base",
    listRule: "@request.auth.id != '' && @request.auth.id = user.id",
    viewRule: "@request.auth.id != '' && @request.auth.id = user.id",
    createRule: "@request.auth.id != '' && @request.auth.id = user.id",
    updateRule: "@request.auth.id != '' && @request.auth.id = user.id",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user.id",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "project_id",
        type: "text",
        required: false,
      },
      {
        name: "slug",
        type: "text",
        required: true,
      },
      {
        name: "subdomain",
        type: "text",
        required: true,
      },
      {
        name: "status",
        type: "select",
        required: true,
        values: ["live", "idle", "building", "failed"]
      },
      {
        name: "container_name",
        type: "text",
        required: false,
      },
      {
        name: "visitors",
        type: "number",
        required: false,
      },
      {
        name: "last_active",
        type: "date",
        required: false,
      },
      {
        name: "website_id",
        type: "text",
        required: false,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_deployments_slug` ON `deployments` (`slug`)"
    ]
  });

  app.save(deploymentsCollection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("deployments");
    if (collection) {
      app.delete(collection);
    }
  } catch (e) {
    // Ignore error if collection does not exist
  }
});
