/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collectionsToUpdate = ["projects", "user_api_keys", "deployments"];

  for (const name of collectionsToUpdate) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;

    let modified = false;

    if (!col.fields.getByName("created")) {
      col.fields.add(new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
      }));
      modified = true;
    }

    if (!col.fields.getByName("updated")) {
      col.fields.add(new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }));
      modified = true;
    }

    if (modified) {
      try {
        app.save(col);
        console.log(`[Migration] Added created & updated autodate fields to "${name}" collection.`);
      } catch (err) {
        console.error(`[Migration] Failed to save collection "${name}":`, err);
      }
    }
  }

  // Deduplicate redundant duplicate projects keeping the newest by ID
  try {
    app.db().newQuery(`
      DELETE FROM projects
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY user, chat_id ORDER BY id DESC) as rn
          FROM projects
          WHERE chat_id != '' AND chat_id IS NOT NULL
        ) WHERE rn = 1
      ) AND chat_id != '' AND chat_id IS NOT NULL;
    `).execute();
    console.log("[Migration] Successfully deduplicated projects table.");

    // Backfill created and updated if empty
    app.db().newQuery(`
      UPDATE projects
      SET created = strftime('%Y-%m-%d %H:%M:%fZ', 'now'),
          updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now')
      WHERE created = '' OR created IS NULL;
    `).execute();
  } catch (err) {
    console.warn("[Migration] Projects deduplication note:", err);
  }
}, (app) => {
  // down migration
});
