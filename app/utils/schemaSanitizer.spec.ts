import { describe, expect, it } from 'vitest';
import { resolveTargetCollectionName, sanitizeProjectSchema } from './schemaSanitizer';

describe('schemaSanitizer', () => {
  it('resolves collection names with plural, singular, and _id variants', () => {
    const known = ['classes', 'students', 'grades', 'users'];

    expect(resolveTargetCollectionName('classes', 'class', known)).toBe('classes');
    expect(resolveTargetCollectionName('class', 'class', known)).toBe('classes');
    expect(resolveTargetCollectionName(undefined, 'class_id', known)).toBe('classes');
    expect(resolveTargetCollectionName(undefined, 'student_id', known)).toBe('students');
    expect(resolveTargetCollectionName(undefined, 'user_id', known)).toBe('users');
    expect(resolveTargetCollectionName(undefined, 'author', known)).toBe('users');
  });

  it('normalizes relation fields using collection, target, or field name', () => {
    const rawSchema = [
      {
        name: 'classes',
        fields: [{ name: 'name', type: 'text' }],
      },
      {
        name: 'students',
        fields: [
          { name: 'name', type: 'text' },
          { name: 'class', type: 'relation', collection: 'classes' },
          { name: 'mentor_id', type: 'relation', target: 'users' },
          { name: 'grade_id', type: 'relation' },
        ],
      },
    ];

    const sanitized = sanitizeProjectSchema(rawSchema);

    const studentFields = sanitized[1].fields;
    // 1. class relation
    expect(studentFields[1].type).toBe('relation');
    expect(studentFields[1].collectionId).toBe('classes');
    expect(studentFields[1].collection).toBeUndefined();

    // 2. mentor_id relation to users
    expect(studentFields[2].type).toBe('relation');
    expect(studentFields[2].collectionId).toBe('users');
    expect(studentFields[2].target).toBeUndefined();

    // 3. grade_id relation (inferred from name)
    expect(studentFields[3].type).toBe('text'); // 'grades' wasn't in rawSchema declared names or known (only classes, students, users)
  });

  it('gracefully degrades unresolvable relation to text to avoid fatal validation error', () => {
    const rawSchema = [
      {
        name: 'notes',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'nonexistent_ref', type: 'relation' },
        ],
      },
    ];

    const sanitized = sanitizeProjectSchema(rawSchema);
    expect(sanitized[0].fields[1].type).toBe('text');
    expect(sanitized[0].fields[1].collectionId).toBeUndefined();
  });
});
