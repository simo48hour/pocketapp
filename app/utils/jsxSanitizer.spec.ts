import { describe, expect, it } from 'vitest';
import { sanitizeJsxEntities } from './jsxSanitizer';

describe('sanitizeJsxEntities', () => {
  it('should fix unescaped (< 10) in JSX text without touching JS expressions', () => {
    const input = `
      <div>
        <span className="text-rose-700">En deçà de la moyenne (< 10)</span>
        <span className="text-slate-600">{insufficient} note(s)</span>
      </div>
    `;

    const expected = `
      <div>
        <span className="text-rose-700">En deçà de la moyenne (&lt; 10)</span>
        <span className="text-slate-600">{insufficient} note(s)</span>
      </div>
    `;

    expect(sanitizeJsxEntities(input)).toBe(expected);
  });

  it('should fix multiple comparisons like (<= 12) and (> 16)', () => {
    const input = '<p>Revue (<= 12) ou élevé (> 16)</p>';
    const expected = '<p>Revue (&le; 12) ou élevé (&gt; 16)</p>';

    expect(sanitizeJsxEntities(input)).toBe(expected);
  });

  it('should not modify comparison operators in JavaScript code or JSX expression blocks', () => {
    const input = `
      const isLow = score < 10;
      for (let i = 0; i < 5; i++) {
        console.log(i);
      }
      return (
        <div>
          {count < 10 ? <span>Low</span> : <span>High</span>}
          {list.filter(x => x <= 5).map(x => <div key={x}>{x}</div>)}
        </div>
      );
    `;

    expect(sanitizeJsxEntities(input)).toBe(input);
  });

  it('should handle multiline JSX text correctly', () => {
    const input = `
      <span>
        En deçà de la moyenne (< 10)
      </span>
    `;

    const expected = `
      <span>
        En deçà de la moyenne (&lt; 10)
      </span>
    `;

    expect(sanitizeJsxEntities(input)).toBe(expected);
  });

  it('should not corrupt comparisons after TypeScript generics', () => {
    const input = `
      const [todos, setTodos] = useState<Todo[]>([]);
      const [count, setCount] = useState<number>(0);
      const map = new Map<string, number>();
      if (todos.length > 0 && count >= 1 && todos.length < 100) {
        return <div>Has todos</div>;
      }
    `;

    expect(sanitizeJsxEntities(input)).toBe(input);
  });

  it('should preserve comparison operators in complex component logic', () => {
    const input = `
      export function Stats({ score, items }: { score: number; items: string[] }) {
        if (score < 5 || items.length > 10) {
          return <div>Alert</div>;
        }
        return (
          <div>
            <span>Grade (< 10)</span>
            {items.map((it, idx) => idx > 0 ? <p key={it}>{it}</p> : null)}
          </div>
        );
      }
    `;

    const expected = `
      export function Stats({ score, items }: { score: number; items: string[] }) {
        if (score < 5 || items.length > 10) {
          return <div>Alert</div>;
        }
        return (
          <div>
            <span>Grade (&lt; 10)</span>
            {items.map((it, idx) => idx > 0 ? <p key={it}>{it}</p> : null)}
          </div>
        );
      }
    `;

    expect(sanitizeJsxEntities(input)).toBe(expected);
  });

  it('should not corrupt JSX tags with Tailwind arbitrary classes or following numbers', () => {
    const input = '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded text-[11px]"> 5 Tones Available</span>';
    expect(sanitizeJsxEntities(input)).toBe(input);
  });

  it('should not corrupt JSX tags followed by numbers like 23', () => {
    const input = '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded"> 23</span>';
    expect(sanitizeJsxEntities(input)).toBe(input);
  });
});

