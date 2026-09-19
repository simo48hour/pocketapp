import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { logStore } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { exportAsJSON, exportAsCSV, exportAsPDF, exportAsText } from './EventLogsExport';
import { LogEntryItem } from './LogEntryItem';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

const logLevelOptions: SelectOption[] = [
  {
    value: 'all',
    label: 'All Types',
    icon: 'i-ph:funnel',
    color: '#9333ea',
  },
  {
    value: 'provider',
    label: 'LLM',
    icon: 'i-ph:robot',
    color: '#10b981',
  },
  {
    value: 'api',
    label: 'API',
    icon: 'i-ph:cloud',
    color: '#3b82f6',
  },
  {
    value: 'error',
    label: 'Errors',
    icon: 'i-ph:warning-circle',
    color: '#ef4444',
  },
  {
    value: 'warning',
    label: 'Warnings',
    icon: 'i-ph:warning',
    color: '#f59e0b',
  },
  {
    value: 'info',
    label: 'Info',
    icon: 'i-ph:info',
    color: '#3b82f6',
  },
  {
    value: 'debug',
    label: 'Debug',
    icon: 'i-ph:bug',
    color: '#6b7280',
  },
];

interface ExportFormat {
  id: string;
  label: string;
  icon: string;
  handler: () => void;
}

export function EventLogsTab() {
  const logs = useStore(logStore.logs);
  const [selectedLevel, setSelectedLevel] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [use24Hour, setUse24Hour] = useState(false);
  const [autoExpand, setAutoExpand] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const levelFilterRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    const allLogs = Object.values(logs);

    if (selectedLevel === 'all') {
      return allLogs.filter((log) =>
        searchQuery ? log.message.toLowerCase().includes(searchQuery.toLowerCase()) : true,
      );
    }

    return allLogs.filter((log) => {
      const matchesType = log.category === selectedLevel || log.level === selectedLevel;
      const matchesSearch = searchQuery ? log.message.toLowerCase().includes(searchQuery.toLowerCase()) : true;

      return matchesType && matchesSearch;
    });
  }, [logs, selectedLevel, searchQuery]);

  // Add performance tracking on mount
  useEffect(() => {
    const startTime = performance.now();

    logStore.logInfo('Event Logs tab mounted', {
      type: 'component_mount',
      message: 'Event Logs tab component mounted',
      component: 'EventLogsTab',
    });

    return () => {
      const duration = performance.now() - startTime;
      logStore.logPerformanceMetric('EventLogsTab', 'mount-duration', duration);
    };
  }, []);

  // Log filter changes
  const handleLevelFilterChange = useCallback(
    (newLevel: string) => {
      logStore.logInfo('Log level filter changed', {
        type: 'filter_change',
        message: `Log level filter changed from ${selectedLevel} to ${newLevel}`,
        component: 'EventLogsTab',
        previousLevel: selectedLevel,
        newLevel,
      });
      setSelectedLevel(newLevel as string);
      setShowLevelFilter(false);
    },
    [selectedLevel],
  );

  // Log search changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        logStore.logInfo('Log search performed', {
          type: 'search',
          message: `Search performed with query "${searchQuery}" (${filteredLogs.length} results)`,
          component: 'EventLogsTab',
          query: searchQuery,
          resultsCount: filteredLogs.length,
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filteredLogs.length]);

  // Enhanced refresh handler
  const handleRefresh = useCallback(async () => {
    const startTime = performance.now();
    setIsRefreshing(true);

    try {
      await logStore.refreshLogs();

      const duration = performance.now() - startTime;

      logStore.logSuccess('Logs refreshed successfully', {
        type: 'refresh',
        message: `Successfully refreshed ${Object.keys(logs).length} logs`,
        component: 'EventLogsTab',
        duration,
        logsCount: Object.keys(logs).length,
      });
    } catch (error) {
      logStore.logError('Failed to refresh logs', error, {
        type: 'refresh_error',
        message: 'Failed to refresh logs',
        component: 'EventLogsTab',
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [logs]);

  // Log preference changes
  const handlePreferenceChange = useCallback((type: string, value: boolean) => {
    logStore.logInfo('Log preference changed', {
      type: 'preference_change',
      message: `Log preference "${type}" changed to ${value}`,
      component: 'EventLogsTab',
      preference: type,
      value,
    });

    switch (type) {
      case 'timestamps':
        setShowTimestamps(value);
        break;
      case '24hour':
        setUse24Hour(value);
        break;
      case 'autoExpand':
        setAutoExpand(value);
        break;
    }
  }, []);

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (levelFilterRef.current && !levelFilterRef.current.contains(event.target as Node)) {
        setShowLevelFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLevelOption = logLevelOptions.find((opt) => opt.value === selectedLevel);

  // Export functions
  const handleExportJSON = () => {
    exportAsJSON({ filteredLogs, selectedLevel, searchQuery, use24Hour, showTimestamps, autoExpand });
  };

  const handleExportCSV = () => {
    exportAsCSV(filteredLogs);
  };

  const handleExportPDF = () => {
    exportAsPDF({ filteredLogs, selectedLevel, searchQuery, use24Hour, showTimestamps, autoExpand });
  };

  const handleExportText = () => {
    exportAsText(filteredLogs);
  };

  const exportFormats: ExportFormat[] = [
    {
      id: 'json',
      label: 'Export as JSON',
      icon: 'i-ph:file-js',
      handler: handleExportJSON,
    },
    {
      id: 'csv',
      label: 'Export as CSV',
      icon: 'i-ph:file-csv',
      handler: handleExportCSV,
    },
    {
      id: 'pdf',
      label: 'Export as PDF',
      icon: 'i-ph:file-pdf',
      handler: handleExportPDF,
    },
    {
      id: 'txt',
      label: 'Export as Text',
      icon: 'i-ph:file-text',
      handler: handleExportText,
    },
  ];

  const ExportButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
    }, []);

    const handleFormatClick = useCallback((handler: () => void) => {
      handler();
      setIsOpen(false);
    }, []);

    return (
      <DialogRoot open={isOpen} onOpenChange={handleOpenChange}>
        <button
          onClick={() => setIsOpen(true)}
          className={classNames(
            'group flex items-center gap-2',
            'rounded-lg px-3 py-1.5',
            'text-sm text-gray-900 dark:text-white',
            'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
            'transition-all duration-200',
          )}
        >
          <span className="i-ph:download text-lg text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
          Export
        </button>

        <Dialog showCloseButton>
          <div className="p-6">
            <DialogTitle className="flex items-center gap-2">
              <div className="i-ph:download w-5 h-5" />
              Export Event Logs
            </DialogTitle>

            <div className="mt-4 flex flex-col gap-2">
              {exportFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleFormatClick(format.handler)}
                  className={classNames(
                    'flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors w-full text-left',
                    'bg-white dark:bg-[#0A0A0A]',
                    'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                    'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
                    'hover:border-purple-200 dark:hover:border-purple-900/30',
                    'text-bolt-elements-textPrimary',
                  )}
                >
                  <div className={classNames(format.icon, 'w-5 h-5')} />
                  <div>
                    <div className="font-medium">{format.label}</div>
                    <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                      {format.id === 'json' && 'Export as a structured JSON file'}
                      {format.id === 'csv' && 'Export as a CSV spreadsheet'}
                      {format.id === 'pdf' && 'Export as a formatted PDF document'}
                      {format.id === 'txt' && 'Export as a formatted text file'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <DropdownMenu.Root open={showLevelFilter} onOpenChange={setShowLevelFilter}>
          <DropdownMenu.Trigger asChild>
            <button
              className={classNames(
                'flex items-center gap-2',
                'rounded-lg px-3 py-1.5',
                'text-sm text-gray-900 dark:text-white',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
                'transition-all duration-200',
              )}
            >
              <span
                className={classNames('text-lg', selectedLevelOption?.icon || 'i-ph:funnel')}
                style={{ color: selectedLevelOption?.color }}
              />
              {selectedLevelOption?.label || 'All Types'}
              <span className="i-ph:caret-down text-lg text-gray-500 dark:text-gray-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-white dark:bg-[#0A0A0A] rounded-lg shadow-lg py-1 z-[250] animate-in fade-in-0 zoom-in-95 border border-[#E5E5E5] dark:border-[#1A1A1A]"
              sideOffset={5}
              align="start"
              side="bottom"
            >
              {logLevelOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  className="group flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-500/10 dark:hover:bg-purple-500/20 cursor-pointer transition-colors"
                  onClick={() => handleLevelFilterChange(option.value)}
                >
                  <div className="mr-3 flex h-5 w-5 items-center justify-center">
                    <div
                      className={classNames(option.icon, 'text-lg group-hover:text-purple-500 transition-colors')}
                      style={{ color: option.color }}
                    />
                  </div>
                  <span className="group-hover:text-purple-500 transition-colors">{option.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showTimestamps}
              onCheckedChange={(value) => handlePreferenceChange('timestamps', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">Show Timestamps</span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={use24Hour}
              onCheckedChange={(value) => handlePreferenceChange('24hour', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">24h Time</span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={autoExpand}
              onCheckedChange={(value) => handlePreferenceChange('autoExpand', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">Auto Expand</span>
          </div>

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={handleRefresh}
            className={classNames(
              'group flex items-center gap-2',
              'rounded-lg px-3 py-1.5',
              'text-sm text-gray-900 dark:text-white',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
              'transition-all duration-200',
              { 'animate-spin': isRefreshing },
            )}
          >
            <span className="i-ph:arrows-clockwise text-lg text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
            Refresh
          </button>

          <ExportButton />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={classNames(
              'w-full px-4 py-2 pl-10 rounded-lg',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500',
              'transition-all duration-200',
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="i-ph:magnifying-glass text-lg text-gray-500 dark:text-gray-400" />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={classNames(
              'flex flex-col items-center justify-center gap-4',
              'rounded-lg p-8 text-center',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            )}
          >
            <span className="i-ph:clipboard-text text-4xl text-gray-400 dark:text-gray-600" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">No Logs Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
            </div>
          </motion.div>
        ) : (
          filteredLogs.map((log) => (
            <LogEntryItem
              key={log.id}
              log={log}
              isExpanded={autoExpand}
              use24Hour={use24Hour}
              showTimestamp={showTimestamps}
            />
          ))
        )}
      </div>
    </div>
  );
}
