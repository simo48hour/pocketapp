import { chatId } from '~/lib/persistence/chatId';
import { chatProjectId } from '~/lib/persistence';
import { ensureProjectDatabase, projectDatabaseRequest, syncProjectSchema } from '~/lib/persistence/projectDatabase';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  Database,
  Table,
  Shield,
  Search,
  Plus,
  RefreshCw,
  Sliders,
  FileJson,
  Trash2,
  Edit2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpDown,
  Lock,
  Unlock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

export interface PbField {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  options?: {
    values?: string[];
    min?: number;
    max?: number;
    [key: string]: any;
  };
}

export interface PbCollection {
  id?: string;
  name: string;
  type: 'base' | 'auth' | 'view';
  system?: boolean;
  schema: PbField[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
}

const DEFAULT_USERS_COLLECTION: PbCollection = {
  id: '_pb_users_auth_',
  name: 'users',
  type: 'auth',
  system: true,
  schema: [
    { name: 'username', type: 'text', required: true, unique: true },
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'name', type: 'text', required: false },
    { name: 'avatar', type: 'file', required: false },
  ],
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '',
  updateRule: '@request.auth.id = id',
  deleteRule: '@request.auth.id = id',
};

export const DatabaseViewer: React.FC = () => {
  const files = useStore(workbenchStore.files);

  const [selectedCollectionName, setSelectedCollectionName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'records' | 'schema' | 'rules' | 'json'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const currentChatId = useStore(chatId);
  const currentProjectId = useStore(chatProjectId);
  const [records, setRecords] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isNewRecordModalOpen, setIsNewRecordModalOpen] = useState(false);
  const [newRecordData, setNewRecordData] = useState<Record<string, any>>({});
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(true);

  const [customCollections, setCustomCollections] = useState<PbCollection[]>([]);
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // 1. Parse collections from pb_schema.json, scan project files, or inspect storage
  const collections = useMemo<PbCollection[]>(() => {
    const parsedMap = new Map<string, PbCollection>();

    // Helper to normalize schema/fields
    const normalizeFields = (rawFields: any[]): PbField[] => {
      if (!Array.isArray(rawFields)) return [];
      return rawFields.map((f) => {
        if (typeof f === 'string') return { name: f, type: 'text' };
        return {
          name: f?.name || f?.id || 'field',
          type: f?.type || 'text',
          required: !!f?.required,
          unique: !!f?.unique,
          options: f?.options || (f?.values ? { values: f.values } : undefined),
        };
      });
    };

    // Check pb_schema.json or any schema JSON in root or subfolders
    for (const [filePath, file] of Object.entries(files)) {
      if (
        (filePath.endsWith('pb_schema.json') || filePath.endsWith('schema.json')) &&
        file?.type === 'file' &&
        file.content
      ) {
        try {
          const json = JSON.parse(file.content);
          const cols = Array.isArray(json)
            ? json
            : Array.isArray(json?.collections)
              ? json.collections
              : Array.isArray(json?.result)
                ? json.result
                : json?.name
                  ? [json]
                  : [];

          for (const col of cols) {
            if (col && typeof col.name === 'string') {
              const name = col.name.trim();
              if (name && name !== 'users' && !name.startsWith('_')) {
                const schema = normalizeFields(col.fields || col.schema || []);
                parsedMap.set(name, {
                  id: col.id || `col_${name}`,
                  name,
                  type: col.type || 'base',
                  system: false,
                  schema:
                    schema.length > 0
                      ? schema
                      : [
                          { name: 'title', type: 'text', required: true },
                          { name: 'description', type: 'text', required: false },
                          { name: 'status', type: 'select', options: { values: ['todo', 'in_progress', 'done'] } },
                        ],
                  listRule: col.listRule !== undefined ? col.listRule : '',
                  viewRule: col.viewRule !== undefined ? col.viewRule : '',
                  createRule: col.createRule !== undefined ? col.createRule : '',
                  updateRule: col.updateRule !== undefined ? col.updateRule : '',
                  deleteRule: col.deleteRule !== undefined ? col.deleteRule : '',
                });
              }
            }
          }
        } catch (e) {
          console.warn('[DatabaseViewer] Failed to parse pb_schema.json:', e);
        }
      }
    }

    // Inspect code and migration files for pb.collection('...') calls
    const detectedNames = new Set<string>();
    const collectionRegex = /pb\.collection(?:<[^>]+>)?\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    const migrationRegex = /\bCollection\s*\(\s*\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/g;

    for (const [filePath, file] of Object.entries(files)) {
      if (file?.type === 'file' && typeof file.content === 'string') {
        // Code calls
        for (const match of file.content.matchAll(collectionRegex)) {
          const name = match[1]?.trim();
          if (name && name !== 'users' && !name.startsWith('_')) {
            detectedNames.add(name);
          }
        }
        // Migrations
        if (filePath.includes('pb_migrations')) {
          for (const match of file.content.matchAll(migrationRegex)) {
            const name = match[1]?.trim();
            if (name && name !== 'users' && !name.startsWith('_')) {
              detectedNames.add(name);
            }
          }
        }
      }
    }

    // Synthesize schema for detected collections not already in parsedMap
    for (const colName of Array.from(detectedNames)) {
      if (!parsedMap.has(colName)) {
        let inferredFields: PbField[] = [
          { name: 'title', type: 'text', required: true },
          { name: 'status', type: 'select', options: { values: ['todo', 'in_progress', 'done'] } },
        ];

        if (
          colName.includes('task') ||
          colName.includes('todo') ||
          colName.includes('board') ||
          colName.includes('kanban')
        ) {
          inferredFields = [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'text', required: false },
            { name: 'status', type: 'select', options: { values: ['backlog', 'todo', 'in_progress', 'done'] } },
            { name: 'priority', type: 'select', options: { values: ['low', 'medium', 'high'] } },
          ];
        } else if (colName.includes('post') || colName.includes('article')) {
          inferredFields = [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'text', required: false },
            { name: 'published', type: 'bool', required: false },
          ];
        } else if (colName.includes('note')) {
          inferredFields = [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'text', required: false },
            { name: 'tags', type: 'text', required: false },
          ];
        }

        parsedMap.set(colName, {
          id: `inferred_${colName}`,
          name: colName,
          type: 'base',
          system: false,
          schema: inferredFields,
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: '',
        });
      }
    }

    // Include any user-created custom collections
    for (const col of customCollections) {
      if (!parsedMap.has(col.name)) {
        parsedMap.set(col.name, col);
      }
    }

    // If still no application collections detected, check project context for tasks/todos
    if (parsedMap.size === 0) {
      const fileNames = Object.keys(files).join(' ').toLowerCase();
      if (
        fileNames.includes('task') ||
        fileNames.includes('todo') ||
        fileNames.includes('kanban') ||
        fileNames.includes('board')
      ) {
        parsedMap.set('tasks', {
          id: 'inferred_tasks',
          name: 'tasks',
          type: 'base',
          system: false,
          schema: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'text', required: false },
            { name: 'status', type: 'select', options: { values: ['backlog', 'todo', 'in_progress', 'done'] } },
            { name: 'priority', type: 'select', options: { values: ['low', 'medium', 'high'] } },
          ],
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: '',
        });
      }
    }

    const result = Array.from(parsedMap.values());

    // Always ensure users system collection is first
    result.unshift(DEFAULT_USERS_COLLECTION);

    return result;
  }, [files, customCollections]);

  // Set initial selected collection
  useEffect(() => {
    if (!selectedCollectionName && collections.length > 0) {
      // Pick first non-system collection, or fallback to first collection
      const appCol = collections.find((c) => !c.system);
      setSelectedCollectionName(appCol ? appCol.name : collections[0].name);
    }
  }, [collections, selectedCollectionName]);

  const activeCollection = useMemo(() => {
    return collections.find((c) => c.name === selectedCollectionName) || collections[0];
  }, [collections, selectedCollectionName]);

  const schemaFile = Object.entries(files).find(
    ([name]) => name.endsWith('/pb_schema.json') || name === 'pb_schema.json',
  )?.[1];
  const schemaText = schemaFile?.type === 'file' ? schemaFile.content : undefined;
  const loadRecords = useCallback(async () => {
    const effectiveId =
      currentProjectId ||
      currentChatId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pocketapp_draft_chat_id') || undefined : undefined);

    if (!activeCollection || !effectiveId) return;
    setIsLoadingRecords(true);
    try {
      const project = await ensureProjectDatabase(currentChatId, currentProjectId);
      if (schemaText) {
        try {
          await syncProjectSchema(project, JSON.parse(schemaText));
        } catch (schemaErr) {
          console.warn('[DatabaseViewer] Schema sync warning (schema may be streaming):', schemaErr);
        }
      }
      const response = await projectDatabaseRequest(
        project,
        'admin/api/collections/' + encodeURIComponent(activeCollection.name) + '/records?perPage=500',
      );
      const data = (await response.json()) as { items: any[] };
      setRecords(data.items);
      setIsLiveConnected(true);
    } catch (error) {
      setRecords([]);
      setIsLiveConnected(false);
      toast.error(error instanceof Error ? error.message : 'Could not load database records');
    } finally {
      setIsLoadingRecords(false);
    }
  }, [activeCollection, currentChatId, currentProjectId, schemaText]);

  useEffect(() => {
    setRecords([]);
    setIsLiveConnected(false);
    setIsLoadingRecords(true);
    setPage(1);
    void loadRecords();
  }, [loadRecords]);

  // Handler to create a new custom collection
  const handleCreateCollection = async () => {
    const cleanName = newCollectionName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '');
    if (!cleanName) {
      toast.error('Please enter a collection name');
      return;
    }
    if (collections.some((c) => c.name === cleanName)) {
      toast.error(`Collection "${cleanName}" already exists`);
      return;
    }

    const newCol: PbCollection = {
      id: `col_${cleanName}`,
      name: cleanName,
      type: 'base',
      system: false,
      schema: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'status', type: 'select', options: { values: ['todo', 'in_progress', 'done'] } },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    };

    try {
      const project = await ensureProjectDatabase(currentChatId, currentProjectId);
      await syncProjectSchema(project, [newCol]);
      setCustomCollections((prev) => [...prev, newCol]);
      setSelectedCollectionName(cleanName);
      setIsNewCollectionModalOpen(false);
      setNewCollectionName('');
      toast.success('Collection created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create collection');
    }
  };

  // Filter & sort records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (recordSearch.trim()) {
      const q = recordSearch.toLowerCase();
      result = result.filter((rec) => {
        return Object.values(rec).some((val) => String(val).toLowerCase().includes(q));
      });
    }

    result.sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, recordSearch, sortField, sortDirection]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Copy ID
  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setIsCopiedId(id);
    setTimeout(() => setIsCopiedId(null), 1500);
    toast.success('Record ID copied to clipboard');
  };

  const handleDeleteRecord = async (id: string) => {
    if (!activeCollection) return;
    try {
      const project = await ensureProjectDatabase(currentChatId, currentProjectId);
      await projectDatabaseRequest(
        project,
        'admin/api/collections/' + encodeURIComponent(activeCollection.name) + '/records/' + encodeURIComponent(id),
        { method: 'DELETE' },
      );
      await loadRecords();
      toast.success('Record deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete record');
    }
  };

  const handleSaveRecord = async () => {
    if (!activeCollection) return;
    try {
      const project = await ensureProjectDatabase(currentChatId, currentProjectId);
      const suffix = editingRecord ? '/' + encodeURIComponent(editingRecord.id) : '';
      const data = { ...newRecordData };
      for (const field of ['id', 'created', 'updated', 'collectionId', 'collectionName', 'expand']) delete data[field];
      await projectDatabaseRequest(
        project,
        'admin/api/collections/' + encodeURIComponent(activeCollection.name) + '/records' + suffix,
        { method: editingRecord ? 'PATCH' : 'POST', body: JSON.stringify(data) },
      );
      await loadRecords();
      toast.success(editingRecord ? 'Record updated' : 'Record created');
      setIsNewRecordModalOpen(false);
      setEditingRecord(null);
      setNewRecordData({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save record');
    }
  };

  // Open edit modal
  const handleOpenEdit = (rec: any) => {
    setEditingRecord(rec);
    setNewRecordData({ ...rec });
    setIsNewRecordModalOpen(true);
  };

  // Export records JSON
  const handleExportJson = () => {
    if (!activeCollection) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeCollection.name}_records.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${records.length} records`);
  };

  // Get field type badge styling
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'text':
      case 'string':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'bool':
      case 'boolean':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'select':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'relation':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'file':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      case 'email':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'json':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-zinc-200/80 dark:bg-zinc-700/20 text-zinc-700 dark:text-zinc-300 border-zinc-300/80 dark:border-zinc-700/30';
    }
  };

  // Group collections
  const appCollections = collections.filter((c) => !c.system);
  const systemCollections = collections.filter((c) => c.system);

  const filteredAppCollections = appCollections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSystemCollections = systemCollections.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full w-full bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 overflow-hidden font-sans">
      {/* ─── LEFT SIDEBAR: Collections Tree ─────────────────────────────────────────── */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-zinc-50/70 dark:bg-zinc-900/40 shrink-0 select-none">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-wide">Collections</span>
          </div>
          <button
            onClick={loadRecords}
            disabled={isLoadingRecords}
            title="Refresh database collections"
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 transition disabled:opacity-50"
          >
            <RefreshCw className={classNames('w-3.5 h-3.5', isLoadingRecords && 'animate-spin text-violet-600 dark:text-violet-400')} />
          </button>
        </div>

        {/* Search collections */}
        <div className="p-2 border-b border-zinc-200 dark:border-zinc-800/60">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500/50 transition"
            />
          </div>
        </div>

        {/* Collections List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 modern-scrollbar">
          {/* Application Collections */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Application</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">({appCollections.length})</span>
                <button
                  onClick={() => setIsNewCollectionModalOpen(true)}
                  className="p-0.5 rounded text-zinc-500 hover:text-violet-600 hover:bg-violet-500/10 dark:text-zinc-400 dark:hover:text-violet-400 transition"
                  title="Create new collection / table"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-0.5 mt-1">
              {filteredAppCollections.length === 0 ? (
                <div className="px-2 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">No collections found</div>
              ) : (
                filteredAppCollections.map((col) => {
                  const isSelected = col.name === activeCollection?.name;
                  return (
                    <button
                      key={col.name}
                      onClick={() => setSelectedCollectionName(col.name)}
                      className={classNames(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition group',
                        isSelected
                          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-sm font-semibold'
                          : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200 border border-transparent',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table
                          className={classNames(
                            'w-3.5 h-3.5 shrink-0',
                            isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400',
                          )}
                        />
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span
                        className={classNames(
                          'text-[10px] px-1.5 py-0.2 rounded-full border',
                          isSelected
                            ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30'
                            : 'bg-zinc-200/80 text-zinc-600 border-zinc-300/80 dark:bg-zinc-800/60 dark:text-zinc-500 dark:border-zinc-700/40',
                        )}
                      >
                        {col.type}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* System Collections */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>System / Auth</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600">({systemCollections.length})</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {filteredSystemCollections.map((col) => {
                const isSelected = col.name === activeCollection?.name;
                return (
                  <button
                    key={col.name}
                    onClick={() => setSelectedCollectionName(col.name)}
                    className={classNames(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition group',
                      isSelected
                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-sm font-semibold'
                        : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200 border border-transparent',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Shield
                        className={classNames(
                          'w-3.5 h-3.5 shrink-0',
                          isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400',
                        )}
                      />
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/80 text-zinc-600 border border-zinc-300/80 dark:bg-zinc-800/60 dark:text-zinc-500 dark:border-zinc-700/40">
                      auth
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Status Footer */}
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-zinc-950/40 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={classNames(
                'w-2 h-2 rounded-full',
                isLiveConnected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-violet-500 dark:bg-violet-400',
              )}
            />
            <span className="truncate">{isLiveConnected ? 'PocketBase connected' : 'Database disconnected'}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">v0.22</span>
        </div>
      </div>

      {/* ─── RIGHT MAIN AREA: Records & Schema Grid ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 overflow-hidden">
        {/* Header Bar */}
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-4 flex items-center justify-between gap-4 shrink-0 bg-zinc-50/70 dark:bg-zinc-900/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{activeCollection?.name}</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-medium">
                {activeCollection?.type}
              </span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-600">•</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {isLoadingRecords ? (
                <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading records...</span>
                </span>
              ) : (
                `${records.length} records · ${activeCollection?.schema?.length || 0} fields`
              )}
            </span>
          </div>

          {/* Sub Tabs: [Data Records] [Schema Structure] [API Rules] [Raw JSON] */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-0.5 shadow-inner">
            <button
              onClick={() => setActiveTab('records')}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition',
                activeTab === 'records' ? 'bg-violet-600 text-white shadow-sm font-semibold' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Data Records</span>
            </button>
            <button
              onClick={() => setActiveTab('schema')}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition',
                activeTab === 'schema' ? 'bg-violet-600 text-white shadow-sm font-semibold' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Schema</span>
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition',
                activeTab === 'rules' ? 'bg-violet-600 text-white shadow-sm font-semibold' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>API Rules</span>
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition',
                activeTab === 'json' ? 'bg-violet-600 text-white shadow-sm font-semibold' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 border border-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700/60 transition"
              title="Export records to JSON"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Export</span>
            </button>
            <button
              onClick={() => {
                setEditingRecord(null);
                setNewRecordData({});
                setIsNewRecordModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Record</span>
            </button>
          </div>
        </div>

        {/* ─── TAB 1: DATA RECORDS VIEW ────────────────────────────────────────────── */}
        {activeTab === 'records' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Bar */}
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="relative flex-1 max-w-sm flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${activeCollection?.name} records...`}
                  value={recordSearch}
                  onChange={(e) => {
                    setRecordSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300/80 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500/50 transition"
                />
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {isLoadingRecords ? (
                  <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Loading...</span>
                  </span>
                ) : (
                  `Showing ${paginatedRecords.length} of ${filteredRecords.length} items`
                )}
              </div>
            </div>

            {/* Records Table */}
            <div className="flex-1 overflow-auto modern-scrollbar relative">
              {isLoadingRecords && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm p-6 select-none animate-in fade-in duration-150">
                  <div className="relative mb-4 flex items-center justify-center">
                    <div className="absolute w-20 h-20 rounded-full bg-violet-500/15 dark:bg-violet-600/20 blur-xl animate-pulse" />
                    <div className="relative w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl shadow-violet-500/10 flex items-center justify-center">
                      <div className="relative flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-600 animate-spin dark:border-violet-400/20 dark:border-t-violet-400" />
                        <Database className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 absolute animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    Loading {activeCollection?.name || 'database'} records...
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
                    Connecting to PocketBase and loading collection data
                  </p>
                  <div className="w-full max-w-sm mt-6 space-y-2.5 opacity-60">
                    <div className="h-7 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-md animate-pulse" />
                    <div className="h-7 bg-zinc-200/40 dark:bg-zinc-800/40 rounded-md animate-pulse" />
                    <div className="h-7 bg-zinc-200/20 dark:bg-zinc-800/20 rounded-md animate-pulse" />
                  </div>
                </div>
              )}

              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[11px] z-10">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold w-28">
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
                        onClick={() => handleSort('id')}
                      >
                        <span>id</span>
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                      </div>
                    </th>
                    {activeCollection?.schema?.map((f) => (
                      <th key={f.name} className="px-3 py-2.5 font-semibold">
                        <div
                          className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
                          onClick={() => handleSort(f.name)}
                        >
                          <span>{f.name}</span>
                          <span
                            className={classNames(
                              'text-[9px] px-1 py-0.2 rounded border font-mono',
                              getTypeBadge(f.type),
                            )}
                          >
                            {f.type}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-semibold w-24">
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
                        onClick={() => handleSort('created')}
                      >
                        <span>created</span>
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                      </div>
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {isLoadingRecords ? (
                    <tr>
                      <td
                        colSpan={(activeCollection?.schema?.length || 0) + 3}
                        className="py-16 text-center text-zinc-400 dark:text-zinc-500"
                      >
                        <div className="h-48" />
                      </td>
                    </tr>
                  ) : paginatedRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(activeCollection?.schema?.length || 0) + 3}
                        className="py-16 text-center text-zinc-400 dark:text-zinc-500"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Table className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">No records found</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                            Click "+ New Record" to save a record to PocketBase.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition group">
                        {/* ID Column */}
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[80px]">{rec.id}</span>
                            <button
                              onClick={() => handleCopy(rec.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                              title="Copy ID"
                            >
                              {isCopiedId === rec.id ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Field Values */}
                        {activeCollection?.schema?.map((f) => {
                          const val = rec[f.name];

                          if (f.type === 'bool' || typeof val === 'boolean') {
                            return (
                              <td key={f.name} className="px-3 py-2">
                                {val ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> true
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                                    <XCircle className="w-3.5 h-3.5" /> false
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (f.type === 'select' && val) {
                            return (
                              <td key={f.name} className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-violet-700 dark:text-violet-300 border border-zinc-200 dark:border-zinc-700/60">
                                  {String(val)}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={f.name} className="px-3 py-2 text-zinc-800 dark:text-zinc-300 truncate max-w-xs">
                              {val !== undefined && val !== null ? (
                                String(val)
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-600 italic">null</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Created Date */}
                        <td className="px-3 py-2 font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                          {rec.created
                            ? new Date(rec.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>

                        {/* Row Actions */}
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1 rounded hover:bg-zinc-200/80 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                              title="Edit record"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition"
                              title="Delete record"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span>
                  Page {page} of {totalPages}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-800 dark:text-zinc-300 outline-none"
                >
                  <option value={10}>10 rows</option>
                  <option value={15}>15 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 dark:border-transparent dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 transition"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 dark:border-transparent dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: SCHEMA STRUCTURE VIEW ────────────────────────────────────────── */}
        {activeTab === 'schema' && (
          <div className="flex-1 overflow-auto p-6 modern-scrollbar space-y-6">
            <div className="max-w-4xl space-y-6">
              {/* Overview Card */}
              <div className="bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>{activeCollection?.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-medium">
                      {activeCollection?.type} collection
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Defines database schema, field validations, and storage properties.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500">ID: </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{activeCollection?.id || 'auto'}</span>
                  </div>
                </div>
              </div>

              {/* Fields Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/30">
                <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                    Fields ({activeCollection?.schema?.length || 0})
                  </h4>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {/* System primary key */}
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200">id</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            primary key
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">15-char unique record identifier</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">SYSTEM</span>
                  </div>

                  {/* Schema defined fields */}
                  {activeCollection?.schema?.map((field) => (
                    <div key={field.name} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-violet-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200">{field.name}</span>
                            <span
                              className={classNames(
                                'text-[9px] px-1.5 py-0.2 rounded font-mono border',
                                getTypeBadge(field.type),
                              )}
                            >
                              {field.type}
                            </span>
                            {field.required && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                required
                              </span>
                            )}
                            {field.unique && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                unique
                              </span>
                            )}
                          </div>
                          {field.options?.values && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Values:</span>
                              {field.options.values.map((v) => (
                                <span
                                  key={v}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono"
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                        {field.required ? 'MANDATORY' : 'OPTIONAL'}
                      </span>
                    </div>
                  ))}

                  {/* System timestamps */}
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold font-mono text-zinc-600 dark:text-zinc-400">created / updated</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                            datetime
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Automatic ISO-8601 audit timestamps</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">SYSTEM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: API RULES VIEW ──────────────────────────────────────────────── */}
        {activeTab === 'rules' && (
          <div className="flex-1 overflow-auto p-6 modern-scrollbar">
            <div className="max-w-3xl space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span>PocketBase Access & Security Rules</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Control authorization expressions for CRUD actions on `{activeCollection?.name}`.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { name: 'List Rule', rule: activeCollection?.listRule, desc: 'Controls who can list/search records' },
                  {
                    name: 'View Rule',
                    rule: activeCollection?.viewRule,
                    desc: 'Controls who can view a single record',
                  },
                  {
                    name: 'Create Rule',
                    rule: activeCollection?.createRule,
                    desc: 'Controls who can create new records',
                  },
                  {
                    name: 'Update Rule',
                    rule: activeCollection?.updateRule,
                    desc: 'Controls who can update existing records',
                  },
                  { name: 'Delete Rule', rule: activeCollection?.deleteRule, desc: 'Controls who can delete records' },
                ].map((item) => {
                  const isPublic = item.rule === '';
                  const isLocked = item.rule === null;

                  return (
                    <div
                      key={item.name}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</span>
                          {isPublic ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <Unlock className="w-3 h-3" /> Public Access
                            </span>
                          ) : isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                              <Lock className="w-3 h-3" /> Admin Only (Locked)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <Shield className="w-3 h-3" /> Auth Required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{item.desc}</p>
                      </div>
                      <div className="font-mono text-xs text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-950 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800">
                        {item.rule === ''
                          ? '"" (Allow everyone)'
                          : item.rule === null
                            ? 'null (Superuser only)'
                            : item.rule}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: RAW JSON VIEW ────────────────────────────────────────────────── */}
        {activeTab === 'json' && (
          <div className="flex-1 overflow-auto p-4 modern-scrollbar flex flex-col">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">pb_schema.json definition</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activeCollection, null, 2));
                  toast.success('Schema JSON copied to clipboard');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 dark:border-transparent dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs dark:text-zinc-200 transition"
              >
                <Copy className="w-3 h-3" />
                <span>Copy JSON</span>
              </button>
            </div>
            <pre className="flex-1 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-300 overflow-auto modern-scrollbar">
              {JSON.stringify(activeCollection, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ─── MODAL: New / Edit Record ──────────────────────────────────────────────── */}
      {isNewRecordModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>{editingRecord ? 'Edit Record' : 'Add New Record'}</span>
                <span className="text-xs font-mono font-normal text-zinc-400 dark:text-zinc-500">({activeCollection?.name})</span>
              </h3>
              <button
                onClick={() => setIsNewRecordModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto modern-scrollbar">
              {activeCollection?.schema?.map((field) => {
                const val = newRecordData[field.name] ?? '';

                return (
                  <div key={field.name} className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>{field.name}</span>
                        {field.required && <span className="text-red-500 dark:text-red-400">*</span>}
                      </span>
                      <span
                        className={classNames(
                          'text-[9px] px-1 py-0.2 rounded border font-mono',
                          getTypeBadge(field.type),
                        )}
                      >
                        {field.type}
                      </span>
                    </label>

                    {/* Form Controls by Type */}
                    {field.type === 'bool' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(newRecordData[field.name])}
                          onChange={(e) => setNewRecordData({ ...newRecordData, [field.name]: e.target.checked })}
                          className="w-4 h-4 rounded text-violet-600 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 focus:ring-violet-500"
                        />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {Boolean(newRecordData[field.name]) ? 'True' : 'False'}
                        </span>
                      </div>
                    ) : field.type === 'select' && field.options?.values ? (
                      <select
                        value={val}
                        onChange={(e) => setNewRecordData({ ...newRecordData, [field.name]: e.target.value })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500 transition"
                      >
                        <option value="">Select an option...</option>
                        {field.options.values.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={val}
                        placeholder={`Enter ${field.name}...`}
                        onChange={(e) => setNewRecordData({ ...newRecordData, [field.name]: e.target.value })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500 transition"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsNewRecordModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md transition active:scale-95"
              >
                {editingRecord ? 'Update Record' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {isNewCollectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create Table / Collection</h3>
              </div>
              <button
                onClick={() => setIsNewCollectionModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Collection Name</label>
                <input
                  type="text"
                  placeholder="e.g. tasks, todos, projects, notes"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCollection();
                  }}
                  autoFocus
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500 transition"
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                A table will be created with default fields and immediate persistence.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsNewCollectionModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md transition active:scale-95"
              >
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
