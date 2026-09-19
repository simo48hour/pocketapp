/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("projects");
  if (collection) {
    try {
      collection.fields.add(new TextField({
        name: "project_id",
        required: false,
      }));
      app.save(collection);
    } catch (e) {
      console.log("Field project_id error or exists:", e);
    }
  }

  const users = app.findCollectionByNameOrId("users");
  if (users) {
    try {
      const existing = app.findCollectionByNameOrId("sidebar_projects");
      if (!existing) {
        const sidebarProjects = new Collection({
          name: "sidebar_projects",
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
              required: true,
            },
            {
              name: "name",
              type: "text",
              required: true,
            },
            {
              name: "description",
              type: "text",
              required: false,
            },
            {
              name: "color",
              type: "text",
              required: false,
            },
          ],
        });
        app.save(sidebarProjects);
      }
    } catch (e) {
      console.log("sidebar_projects error:", e);
    }
  }
}, (app) => {
  try {
    const projects = app.findCollectionByNameOrId("projects");
    if (projects) {
      projects.fields.removeByName("project_id");
      app.save(projects);
    }
    const sidebarProjects = app.findCollectionByNameOrId("sidebar_projects");
    if (sidebarProjects) {
      app.delete(sidebarProjects);
    }
  } catch (e) {}
});
