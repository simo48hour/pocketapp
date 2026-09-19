import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { createScopedLogger } from '~/utils/logger';
import { WORK_DIR } from '~/utils/constants';
import { path } from '~/utils/path';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type !== 'file') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            // Keep the selected document stable when a different file changes.
            if (previousDocument?.value === dirent.content && previousDocument.isBinary === dirent.isBinary) {
              return [filePath, previousDocument] as [string, EditorDocument];
            }

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                isBinary: dirent.isBinary, // Add this line
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const fullPath = filePath.startsWith('/') ? filePath : path.join(WORK_DIR, filePath);
    const documents = this.documents.get();
    const documentState = documents[fullPath];

    // Check if the file is locked by getting the file from the filesStore
    const file = this.#filesStore.getFile(fullPath);

    if (file?.isLocked) {
      logger.warn(`Attempted to update locked file: ${fullPath}`);
      return;
    }

    if (!documentState) {
      this.documents.setKey(fullPath, {
        value: newContent,
        filePath: fullPath,
        isBinary: false,
      });
      return;
    }

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(fullPath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
