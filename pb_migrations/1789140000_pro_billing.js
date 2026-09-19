migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const hidden = ['openrouter_sub_key', 'openrouter_key_id', 'billing_period_id', 'billing_checkout_id'];
  const text = ['stripe_customer_id', 'stripe_subscription_id', 'subscription_status', ...hidden];
  const numbers = ['monthly_token_usage_usd', 'billing_period_end', 'billing_usage_baseline', 'billing_credit_limit'];
  text.forEach((name) => users.fields.add(new TextField({ name, hidden: hidden.includes(name), max: 2048 })));
  numbers.forEach((name) => users.fields.add(new NumberField({ name, min: 0 })));
  const fields = [...text, ...numbers];
  const guard = fields.map((name) => `@request.body.${name}:isset = false`).join(' && ');
  const create = String(users.createRule || '');
  users.createRule = users.createRule === null ? null : (create ? `(${create}) && ${guard}` : guard);
  const update = String(users.updateRule || '');
  users.updateRule = users.updateRule === null ? null : (update ? `(${update}) && ${guard}` : guard);
  app.save(users);
  app.db().newQuery("UPDATE users SET subscription_status = 'free'").execute();
  app.save(new Collection({
    name: 'billing_locks',
    type: 'base',
    fields: [
      {
        name: 'user',
        type: 'relation',
        collectionId: users.id,
        required: true,
        maxSelect: 1,
        cascadeDelete: true,
      },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_billing_lock_user ON billing_locks (user)'],
  }));
  app.save(new Collection({
    name: 'promo_usage',
    type: 'base',
    fields: [
      {
        name: 'user',
        type: 'relation',
        collectionId: users.id,
        required: true,
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: 'day', type: 'text', required: true },
      { name: 'count', type: 'number', min: 0 },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_promo_user_day ON promo_usage (user, day)'],
  }));
}, () => { /* Billing history is intentionally preserved on rollback. */ });
