import { describe, expect, it, vi } from 'vitest';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';

describe('EnhancedStreamingMessageParser Edge Cases', () => {
  it('should detect and wrap React component code blocks starting with import', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({ callbacks });
    const input = '```tsx\nimport React from "react";\nexport default function App() {\n  return <div>App</div>;\n}\n```';

    parser.parse('test_react_detect', input);

    expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'App.tsx',
      }),
    );
    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'file',
          filePath: '/src/App.tsx',
        }),
      }),
    );
  });

  it('should strip leaked raw code duplicate occurring after boltArtifact', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({ callbacks });
    const input = '<boltArtifact id="test_dup" title="App">\n<boltAction type="file" filePath="src/App.tsx">\nexport default function App() { return <div>App</div>; }\n</boltAction>\n</boltArtifact>\n\nimport React, { useState } from "react";\nexport default function App() {\n  return <div>App</div>;\n}';

    const output = parser.parse('test_leak_dup', input);

    // Leaked duplicate import code should NOT appear in output
    expect(output).not.toContain('import React');
  });

  it('should wrap leaked raw code into an artifact if not in previous actions', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({ callbacks });
    const input = '<boltArtifact id="test_nav" title="Navbar">\n<boltAction type="file" filePath="src/Navbar.tsx">\nexport const Navbar = () => <nav />;\n</boltAction>\n</boltArtifact>\n\nimport React, { useState } from "react";\nexport default function App() {\n  return <div>App</div>;\n}';

    parser.parse('test_leak_new', input);

    // Should have opened actions for both Navbar and App.tsx
    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          filePath: 'src/App.tsx',
        }),
      }),
    );
  });
});
