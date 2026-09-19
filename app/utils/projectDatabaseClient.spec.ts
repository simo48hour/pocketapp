import { describe, expect, it } from 'vitest';
import { projectDatabaseClient, repairLegacyPocketBaseClient } from './projectDatabaseClient';

const legacy =
  'const STORAGE_PREFIX = "pocketapp_pb_"; const originalSend = pb.send.bind(pb); function getStorageItems(collection: string) {}';
describe('saved starter database upgrade', () => {
  it('replaces the known fallback client on restore', () => {
    expect(repairLegacyPocketBaseClient('/home/project/src/lib/pocketbase.ts', legacy)).toBe(projectDatabaseClient);
  });
  it('routes a generated client through the supplied preview endpoint without removing its settings', () => {
    const generated = 'export const pb = new PocketBase(window.location.origin); pb.autoCancellation(false);';
    const repaired = repairLegacyPocketBaseClient('src/lib/pocketbase.ts', generated);
    expect(repaired).toContain(generated);
    expect(repaired).toContain('pb.baseURL =');
    expect(repaired).toContain('pocketapp_origin');
    expect(repairLegacyPocketBaseClient('src/lib/pocketbase.ts', repaired)).toBe(repaired);
  });
  it('preserves custom clients and unrelated files', () => {
    expect(repairLegacyPocketBaseClient('src/lib/pocketbase.ts', 'custom client')).toBe('custom client');
    expect(repairLegacyPocketBaseClient('src/App.tsx', legacy)).toBe(legacy);
  });
  it('persists connection params in storage and listens to postMessage config', () => {
    const generated = 'export const pb = new PocketBase(window.location.origin);';
    const repaired = repairLegacyPocketBaseClient('src/lib/pocketbase.ts', generated);
    expect(repaired).toContain('sessionStorage.setItem');
    expect(repaired).toContain('pocketapp_db_config');
  });

  it('routes the first SDK request before the client is constructed', () => {
    const generated = `function getBaseUrl() {\n  return import.meta.env.VITE_PB_URL || window.location.origin\n}\nexport const pb = new PocketBase(getBaseUrl())`;
    const repaired = repairLegacyPocketBaseClient('src/lib/pocketbase.ts', generated);
    expect(repaired).toContain("params.get('pocketapp_db')");
    expect(repaired).toContain("'/api/project-db/'");
  });
  it('supports alternative exports and instantiations', () => {
    const defaultExport = "const pb = new PocketBase('http://127.0.0.1:8090');\nexport default pb;";
    const repairedDefault = repairLegacyPocketBaseClient('src/lib/pocketbase.ts', defaultExport);
    expect(repairedDefault).toContain('pocketapp-platform-routing');

    const namedExport = "const pb = new PocketBase('http://127.0.0.1:8090');\nexport { pb };";
    const repairedNamed = repairLegacyPocketBaseClient('src/lib/pb.ts', namedExport);
    expect(repairedNamed).toContain('pocketapp-platform-routing');

    const rootPocketBase = "export const pb = new PocketBase('http://127.0.0.1:8090');";
    const repairedRoot = repairLegacyPocketBaseClient('src/pocketbase.ts', rootPocketBase);
    expect(repairedRoot).toContain('pocketapp-platform-routing');
  });
});
