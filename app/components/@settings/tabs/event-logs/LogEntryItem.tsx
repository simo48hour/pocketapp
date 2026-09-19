import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { LogEntry } from '~/lib/stores/logs';

export interface LogEntryItemProps {
  log: LogEntry;
  isExpanded: boolean;
  use24Hour: boolean;
  showTimestamp: boolean;
}

export const LogEntryItem = ({ log, isExpanded: forceExpanded, use24Hour, showTimestamp }: LogEntryItemProps) => {
  const [localExpanded, setLocalExpanded] = useState(forceExpanded);

  useEffect(() => {
    setLocalExpanded(forceExpanded);
  }, [forceExpanded]);

  const timestamp = useMemo(() => {
    const date = new Date(log.timestamp);
    return date.toLocaleTimeString('en-US', { hour12: !use24Hour });
  }, [log.timestamp, use24Hour]);

  const style = useMemo(() => {
    if (log.category === 'provider') {
      return {
        icon: 'i-ph:robot',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20',
        badge: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
      };
    }

    if (log.category === 'api') {
      return {
        icon: 'i-ph:cloud',
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20',
        badge: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
      };
    }

    switch (log.level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          color: 'text-red-500 dark:text-red-400',
          bg: 'hover:bg-red-500/10 dark:hover:bg-red-500/20',
          badge: 'text-red-500 bg-red-50 dark:bg-red-500/10',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          color: 'text-yellow-500 dark:text-yellow-400',
          bg: 'hover:bg-yellow-500/10 dark:hover:bg-yellow-500/20',
          badge: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10',
        };
      case 'debug':
        return {
          icon: 'i-ph:bug',
          color: 'text-gray-500 dark:text-gray-400',
          bg: 'hover:bg-gray-500/10 dark:hover:bg-gray-500/20',
          badge: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10',
        };
      default:
        return {
          icon: 'i-ph:info',
          color: 'text-blue-500 dark:text-blue-400',
          bg: 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20',
          badge: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
        };
    }
  }, [log.level, log.category]);

  const renderDetails = (details: any) => {
    if (log.category === 'provider') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Model: {details.model}</span>
            <span>•</span>
            <span>Tokens: {details.totalTokens}</span>
            <span>•</span>
            <span>Duration: {details.duration}ms</span>
          </div>
          {details.prompt && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Prompt:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {details.prompt}
              </pre>
            </div>
          )}
          {details.response && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Response:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {details.response}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (log.category === 'api') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={details.method === 'GET' ? 'text-green-500' : 'text-blue-500'}>{details.method}</span>
            <span>•</span>
            <span>Status: {details.statusCode}</span>
            <span>•</span>
            <span>Duration: {details.duration}ms</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 break-all">{details.url}</div>
          {details.request && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Request:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.request, null, 2)}
              </pre>
            </div>
          )}
          {details.response && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Response:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.response, null, 2)}
              </pre>
            </div>
          )}
          {details.error && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-red-500">Error:</div>
              <pre className="text-xs text-red-400 bg-red-50 dark:bg-red-500/10 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded whitespace-pre-wrap">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        'flex flex-col gap-2',
        'rounded-lg p-4',
        'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        'border border-[#E5E5E5] dark:border-[#1A1A1A]',
        style.bg,
        'transition-all duration-200',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={classNames('text-lg', style.icon, style.color)} />
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{log.message}</div>
            {log.details && (
              <>
                <button
                  onClick={() => setLocalExpanded(!localExpanded)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                >
                  {localExpanded ? 'Hide' : 'Show'} Details
                </button>
                {localExpanded && renderDetails(log.details)}
              </>
            )}
            <div className="flex items-center gap-2">
              <div className={classNames('px-2 py-0.5 rounded text-xs font-medium uppercase', style.badge)}>
                {log.level}
              </div>
              {log.category && (
                <div className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  {log.category}
                </div>
              )}
            </div>
          </div>
        </div>
        {showTimestamp && <time className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{timestamp}</time>}
      </div>
    </motion.div>
  );
};
