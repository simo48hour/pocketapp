/**
 * Schema Sanitizer for PocketBase
 * Normalizes collection definitions, resolves relation field target collections,
 * and prevents fatal "collectionId: Cannot be blank" errors during deployment.
 */

export interface SchemaField {
  name: string;
  type: string;
  collectionId?: string;
  collection?: string;
  collectionName?: string;
  target?: string;
  targetCollection?: string;
  to?: string;
  relation?: string;
  relatedCollection?: string;
  required?: boolean;
  cascadeDelete?: boolean;
  maxSelect?: number;
  options?: Record<string, any>;
  [key: string]: any;
}

export interface SchemaCollection {
  name: string;
  type?: 'base' | 'auth' | 'view';
  fields?: SchemaField[];
  schema?: SchemaField[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  [key: string]: any;
}

/**
 * Generates plural/singular variants of a name for matching.
 */
function getVariants(name: string): string[] {
  const lower = name.toLowerCase().trim();
  const withoutId = lower.replace(/_id$/i, '').replace(/id$/i, '');

  const candidates = new Set<string>([lower, withoutId]);

  for (const base of [lower, withoutId]) {
    if (!base) continue;
    candidates.add(base + 's');
    candidates.add(base + 'es');
    if (base.endsWith('y')) {
      candidates.add(base.slice(0, -1) + 'ies');
    }
    if (base.endsWith('ies')) {
      candidates.add(base.slice(0, -3) + 'y');
    }
    if (base.endsWith('es')) {
      candidates.add(base.slice(0, -2));
    }
    if (base.endsWith('s')) {
      candidates.add(base.slice(0, -1));
    }
  }

  return Array.from(candidates);
}

/**
 * Resolves the best matching collection name from known collection names.
 */
export function resolveTargetCollectionName(
  targetHint: string | undefined,
  fieldName: string,
  knownCollectionNames: string[],
): string | undefined {
  const userRelated = ['user', 'users', 'author', 'owner', 'creator', 'account', 'profile'];

  // 1. If target hint provided, try matching against known collections
  if (targetHint && targetHint.trim()) {
    const hintTrimmed = targetHint.trim();
    if (hintTrimmed === '_pb_users_auth_') return 'users';

    const direct = knownCollectionNames.find((c) => c.toLowerCase() === hintTrimmed.toLowerCase());
    if (direct) return direct;

    const variants = getVariants(hintTrimmed);
    for (const v of variants) {
      const match = knownCollectionNames.find((c) => c.toLowerCase() === v);
      if (match) return match;
    }

    if (userRelated.some((u) => variants.includes(u))) {
      const userCol = knownCollectionNames.find((c) => c.toLowerCase() === 'users');
      if (userCol) return userCol;
      return 'users';
    }
  }

  // 2. Infer from field name
  if (fieldName && fieldName.trim()) {
    const fieldVariants = getVariants(fieldName);

    if (userRelated.some((u) => fieldVariants.includes(u))) {
      const userCol = knownCollectionNames.find((c) => c.toLowerCase() === 'users');
      if (userCol) return userCol;
      return 'users';
    }

    for (const v of fieldVariants) {
      const match = knownCollectionNames.find((c) => c.toLowerCase() === v);
      if (match) return match;
    }
  }

  return undefined;
}

/**
 * Sanitizes and repairs a PocketBase schema JSON structure.
 * Guarantees every relation field has a valid target collection, or degrades to 'text'
 * to prevent fatal "collectionId: Cannot be blank" errors during publishing.
 */
export function sanitizeProjectSchema(input: unknown): any {
  if (!input) return input;

  const isArray = Array.isArray(input);
  const collections: SchemaCollection[] = isArray
    ? (input as SchemaCollection[])
    : Array.isArray((input as any)?.collections)
      ? (input as any).collections
      : [];

  if (!collections.length) return input;

  // Gather all declared collection names
  const declaredNames = collections.map((c) => c.name).filter(Boolean);
  const knownNames = Array.from(new Set([...declaredNames, 'users']));

  const sanitizedCollections = collections.map((col) => {
    const rawFields = col.fields || col.schema || [];
    if (!Array.isArray(rawFields)) return col;

    const sanitizedFields = rawFields.map((field) => {
      const options = field.options || {};
      const merged: SchemaField = { ...options, ...field };

      // Normalization for booleans
      if (merged.type === 'bool' && merged.name === 'completed') {
        merged.required = false;
      }

      // Handle relation fields
      if (merged.type === 'relation') {
        const hint =
          merged.collectionId ||
          merged.collection ||
          merged.collectionName ||
          merged.target ||
          merged.targetCollection ||
          merged.to ||
          merged.relation ||
          merged.relatedCollection ||
          options.collectionId ||
          options.collection ||
          options.target;

        const resolved = resolveTargetCollectionName(hint, merged.name, knownNames);

        if (resolved) {
          merged.collectionId = resolved === 'users' ? (hint === '_pb_users_auth_' ? '_pb_users_auth_' : 'users') : resolved;
          merged.cascadeDelete = merged.cascadeDelete ?? false;
          merged.maxSelect = merged.maxSelect ?? 1;
        } else {
          // If no matching collection could be found anywhere, degrade to text
          // to prevent fatal PocketBase schema validation rejection.
          merged.type = 'text';
          delete merged.collectionId;
          delete merged.cascadeDelete;
          delete merged.maxSelect;
        }

        // Clean up legacy/non-standard properties
        delete merged.collection;
        delete merged.collectionName;
        delete merged.target;
        delete merged.targetCollection;
        delete merged.to;
        delete merged.relation;
        delete merged.relatedCollection;
      }

      return merged;
    });

    return {
      ...col,
      fields: sanitizedFields,
    };
  });

  return isArray ? sanitizedCollections : { ...(input as any), collections: sanitizedCollections };
}
