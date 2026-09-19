migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const projectsCollection = new Collection({
    name: "projects",
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
        name: "chat_id",
        type: "text",
        required: false,
      },
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "file_tree",
        type: "json",
        required: false,
      },
      {
        name: "prompt_history",
        type: "json",
        required: false,
      },
      {
        name: "pinned",
        type: "bool",
      }
    ]
  });
  app.save(projectsCollection);

  const apiKeysCollection = new Collection({
    name: "user_api_keys",
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
        name: "provider",
        type: "select",
        required: true,
        values: ["OpenRouter", "Anthropic", "OpenAI", "Google", "DeepSeek", "Groq"]
      },
      {
        name: "encrypted_key",
        type: "text",
        required: true,
      },
      {
        name: "key_hint",
        type: "text",
        required: false,
      }
    ]
  });
  app.save(apiKeysCollection);
});
