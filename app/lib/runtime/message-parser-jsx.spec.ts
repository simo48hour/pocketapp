import { describe, expect, it, vi } from 'vitest';
import { StreamingMessageParser } from './message-parser';
import { cleanEscapedTags, sanitizeJsxCode } from './message-parser-utils';

describe('JSX and entity sanitization in StreamingMessageParser', () => {
  it('preserves valid JSX text entities while unescaping HTML tags', () => {
    const raw = '&lt;div className="p-4"&gt;<span>Count: &lt; 10</span><span>Next &gt;</span>&lt;/div&gt;';
    const cleaned = cleanEscapedTags(raw);
    expect(cleaned).toBe('<div className="p-4"><span>Count: &lt; 10</span><span>Next &gt;</span></div>');
  });

  it('repairs closing tags with accidental attributes', () => {
    const broken = `export function ChatArea() {
      return (
        <div className="flex">
          <p>Text</p>
        </div className="flex">
      );
    }`;
    const fixed = sanitizeJsxCode(broken, 'src/components/ChatArea.tsx');
    expect(fixed).toContain('</div>');
    expect(fixed).not.toContain('</div className="flex">');
  });

  it('repairs closing tags with trailing slashes', () => {
    const broken = '<div><span>test</span></div/>';
    const fixed = sanitizeJsxCode(broken, 'src/components/ChatArea.tsx');
    expect(fixed).toBe('<div><span>test</span></div>');
  });

  it('converts HTML comments inside JSX to JSX comments', () => {
    const broken = '<div><!-- comment --><span>test</span></div>';
    const fixed = sanitizeJsxCode(broken, 'src/components/ChatArea.tsx');
    expect(fixed).toBe('<div>{/* comment */}<span>test</span></div>');
  });

  it('repairs dangling self-closing tag slashes before newlines', () => {
    const broken = '<input type="text" /\n<button>Submit</button>';
    const fixed = sanitizeJsxCode(broken, 'src/components/ChatArea.tsx');
    expect(fixed).toBe('<input type="text" />\n<button>Submit</button>');
  });

  it('repairs opening tags ending in &gt; instead of > (Hero.tsx & RizzSimulator.tsx pattern)', () => {
    const brokenHero = '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded"&gt; 23</span>';
    const fixedHero = sanitizeJsxCode(brokenHero, 'src/components/Hero.tsx');
    expect(fixedHero).toBe('<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded"> 23</span>');

    const brokenRizz = '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded text-[11px]"&gt; 5 Tones Available</span>';
    const fixedRizz = sanitizeJsxCode(brokenRizz, 'src/components/RizzSimulator.tsx');
    expect(fixedRizz).toBe('<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded text-[11px]"> 5 Tones Available</span>');
  });

  it('repairs closing tags missing > before next sibling tag (ChatArea.tsx pattern)', () => {
    const broken = '<div className="flex">\n  <p>Some text</p        </div>\n</div>';
    const fixed = sanitizeJsxCode(broken, 'src/components/ChatArea.tsx');
    expect(fixed).toContain('</p>\n</div>');
    expect(fixed).not.toContain('</p        </div>');
  });

  it('repairs leaked continuation restart headers (PricingSection.tsx pattern)', () => {
    const broken = `interface PricingSectionfilePath="src/components/PricingSection.tsx">
  title: string;
}`;
    const fixed = sanitizeJsxCode(broken, 'src/components/PricingSection.tsx');
    expect(fixed).not.toContain('filePath=');
    expect(fixed).toContain('interface PricingSection');

    const brokenRestart = `interface PricingSection
<boltAction type="file" filePath="src/components/PricingSection.tsx">
import React from 'react';
export function PricingSection() { return <div />; }`;
    const fixedRestart = sanitizeJsxCode(brokenRestart, 'src/components/PricingSection.tsx');
    expect(fixedRestart.startsWith("import React from 'react';")).toBe(true);
  });

  it('automatically sanitizes JSX files inside StreamingMessageParser onActionClose', () => {
    const onActionClose = vi.fn();
    const parser = new StreamingMessageParser({ callbacks: { onActionClose } });

    const input = [
      '<boltArtifact id="test-chat" title="Chat Area">',
      '<boltAction type="file" filePath="src/components/ChatArea.tsx">',
      'export function ChatArea() {',
      '  return (',
      '    <div className="p-4">',
      '      <span className="badge"&gt; 23</span>',
      '      <p>Hello</p        </div>',
      '    </div className="p-4">',
      '  );',
      '}',
      '</boltAction>',
      '</boltArtifact>',
    ].join('\n');

    parser.parse('msg-1', input);

    expect(onActionClose).toHaveBeenCalledTimes(1);
    const savedContent = onActionClose.mock.calls[0][0].action.content;
    expect(savedContent).not.toContain('</div className="p-4">');
    expect(savedContent).not.toContain('badge"&gt;');
    expect(savedContent).toContain('badge"> 23</span>');
    expect(savedContent).toContain('<p>Hello</p>');
    expect(savedContent).not.toContain('</p        </div>');
    expect(savedContent).toContain('</div>');
  });

  it('sanitizeGeneratedSource cleans all four reported error patterns before writing to disk', async () => {
    const { sanitizeGeneratedSource } = await import('~/utils/fileUtils');

    // 1. Hero.tsx: opening tag closed with &gt; instead of >
    const heroInput = '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded"&gt; 23</span>';
    expect(sanitizeGeneratedSource('src/components/Hero.tsx', heroInput)).toBe(
      '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded"> 23</span>',
    );

    // 2. RizzSimulator.tsx: opening tag with arbitrary class closed with &gt;
    const rizzInput =
      '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded text-[11px]"&gt; 5 Tones Available</span>';
    expect(sanitizeGeneratedSource('src/components/RizzSimulator.tsx', rizzInput)).toBe(
      '<span className="text-pink-600 font-semibold bg-pink-100 px-1 rounded text-[11px]"> 5 Tones Available</span>',
    );

    // 3. PricingSection.tsx: leaked filePath continuation
    const pricingInput = `interface PricingSectionfilePath="src/components/PricingSection.tsx">
  title: string;
}`;
    const cleanedPricing = sanitizeGeneratedSource('src/components/PricingSection.tsx', pricingInput);
    expect(cleanedPricing).not.toContain('filePath=');
    expect(cleanedPricing).toContain('interface PricingSection');

    // 4. ChatArea.tsx: closing tag missing > before next sibling tag
    const chatInput = '<div>\n  <p>Hello</p        </div>\n</div>';
    const cleanedChat = sanitizeGeneratedSource('src/components/ChatArea.tsx', chatInput);
    expect(cleanedChat).not.toContain('</p        </div>');
    expect(cleanedChat).toContain('<p>Hello</p>');
  });
});


