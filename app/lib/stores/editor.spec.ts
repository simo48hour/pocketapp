import { expect, it, vi } from 'vitest';
import { EditorStore } from './editor';
import type { FilesStore, FileMap } from './files';

it('does not notify the selected editor when another generated file changes', () => {
  const store = new EditorStore({} as FilesStore);
  const files: FileMap = {
    '/a.ts': { type: 'file', content: 'a', isBinary: false },
    '/b.ts': { type: 'file', content: 'b', isBinary: false },
  };
  store.setDocuments(files);
  store.setSelectedFile('/a.ts');
  const listener = vi.fn();
  const unsubscribe = store.currentDocument.listen(listener);
  store.setDocuments({ ...files, '/b.ts': { type: 'file', content: 'updated', isBinary: false } });
  expect(listener).not.toHaveBeenCalled();
  store.setDocuments({ ...files, '/a.ts': { type: 'file', content: 'updated', isBinary: false } });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});
