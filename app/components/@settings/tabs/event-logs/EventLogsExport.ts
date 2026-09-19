import { jsPDF } from 'jspdf';
import { toast } from 'react-toastify';
import type { LogEntry } from '~/lib/stores/logs';

export interface ExportOptions {
  filteredLogs: LogEntry[];
  selectedLevel: string;
  searchQuery: string;
  use24Hour: boolean;
  showTimestamps: boolean;
  autoExpand: boolean;
}

export const exportAsJSON = (options: ExportOptions) => {
  const { filteredLogs, selectedLevel, searchQuery, use24Hour, showTimestamps, autoExpand } = options;

  try {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalLogs: filteredLogs.length,
      logs: filteredLogs,
      filters: {
        level: selectedLevel,
        searchQuery,
      },
      preferences: {
        use24Hour,
        showTimestamps,
        autoExpand,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocketapp-event-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Event logs exported successfully as JSON');
  } catch (error) {
    console.error('Failed to export JSON:', error);
    toast.error('Failed to export event logs as JSON');
  }
};

export const exportAsCSV = (filteredLogs: LogEntry[]) => {
  try {
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Details'];
    const csvData = [
      headers,
      ...filteredLogs.map((log) => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category || '',
        log.message,
        log.details ? JSON.stringify(log.details) : '',
      ]),
    ];

    const csvContent = csvData
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocketapp-event-logs-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Event logs exported successfully as CSV');
  } catch (error) {
    console.error('Failed to export CSV:', error);
    toast.error('Failed to export event logs as CSV');
  }
};

export const exportAsPDF = (options: ExportOptions) => {
  const { filteredLogs, selectedLevel, searchQuery, use24Hour } = options;

  try {
    const doc = new jsPDF();
    const lineHeight = 7;
    let yPos = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - 2 * margin;

    const addSectionHeader = (title: string) => {
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFillColor('#F3F4F6');
      doc.rect(margin - 2, yPos - 5, pageWidth - 2 * (margin - 2), lineHeight + 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#111827');
      doc.setFontSize(12);
      doc.text(title.toUpperCase(), margin, yPos);
      yPos += lineHeight * 2;
    };

    // Header
    doc.setFillColor('#6366F1');
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Event Logs Report', margin, 35);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('PocketApp - AI Development Platform', margin, 45);
    yPos = 70;

    // Report summary
    addSectionHeader('Report Summary');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#374151');

    const summaryItems = [
      { label: 'Generated', value: new Date().toLocaleString() },
      { label: 'Total Logs', value: filteredLogs.length.toString() },
      { label: 'Filter Applied', value: selectedLevel === 'all' ? 'All Types' : selectedLevel },
      { label: 'Search Query', value: searchQuery || 'None' },
      { label: 'Time Format', value: use24Hour ? '24-hour' : '12-hour' },
    ];

    summaryItems.forEach((item) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.label}:`, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, margin + 60, yPos);
      yPos += lineHeight;
    });

    yPos += lineHeight * 2;

    // Statistics
    addSectionHeader('Log Statistics');

    const stats = {
      error: filteredLogs.filter((log) => log.level === 'error').length,
      warning: filteredLogs.filter((log) => log.level === 'warning').length,
      info: filteredLogs.filter((log) => log.level === 'info').length,
      debug: filteredLogs.filter((log) => log.level === 'debug').length,
      provider: filteredLogs.filter((log) => log.category === 'provider').length,
      api: filteredLogs.filter((log) => log.category === 'api').length,
    };

    const leftStats = [
      { label: 'Error Logs', value: stats.error, color: '#DC2626' },
      { label: 'Warning Logs', value: stats.warning, color: '#F59E0B' },
      { label: 'Info Logs', value: stats.info, color: '#3B82F6' },
    ];

    const rightStats = [
      { label: 'Debug Logs', value: stats.debug, color: '#6B7280' },
      { label: 'LLM Logs', value: stats.provider, color: '#10B981' },
      { label: 'API Logs', value: stats.api, color: '#3B82F6' },
    ];

    const colWidth = (pageWidth - 2 * margin) / 2;

    leftStats.forEach((stat, index) => {
      doc.setTextColor(stat.color);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value.toString(), margin, yPos);
      doc.setTextColor('#374151');
      doc.setFont('helvetica', 'normal');
      doc.text(stat.label, margin + 20, yPos);

      if (rightStats[index]) {
        doc.setTextColor(rightStats[index].color);
        doc.setFont('helvetica', 'bold');
        doc.text(rightStats[index].value.toString(), margin + colWidth, yPos);
        doc.setTextColor('#374151');
        doc.setFont('helvetica', 'normal');
        doc.text(rightStats[index].label, margin + colWidth + 20, yPos);
      }

      yPos += lineHeight;
    });

    yPos += lineHeight * 2;

    // Event Logs
    addSectionHeader('Event Logs');

    const addLogEntry = (log: LogEntry) => {
      const entryHeight = 20 + (log.details ? 40 : 0);

      if (yPos + entryHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPos = margin;
      }

      const timestamp = new Date(log.timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24Hour,
      });

      const levelColors: Record<string, string> = {
        error: '#FEE2E2',
        warning: '#FEF3C7',
        info: '#DBEAFE',
        debug: '#F3F4F6',
      };

      const textColors: Record<string, string> = {
        error: '#DC2626',
        warning: '#F59E0B',
        info: '#3B82F6',
        debug: '#6B7280',
      };

      const levelWidth = doc.getTextWidth(log.level.toUpperCase()) + 10;
      doc.setFillColor(levelColors[log.level] || '#F3F4F6');
      doc.roundedRect(margin, yPos - 4, levelWidth, lineHeight + 4, 1, 1, 'F');

      doc.setTextColor(textColors[log.level] || '#6B7280');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(log.level.toUpperCase(), margin + 5, yPos);

      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(timestamp, margin + levelWidth + 10, yPos);

      if (log.category) {
        const categoryX = margin + levelWidth + doc.getTextWidth(timestamp) + 20;
        doc.setFillColor('#F3F4F6');

        const categoryWidth = doc.getTextWidth(log.category) + 10;
        doc.roundedRect(categoryX, yPos - 4, categoryWidth, lineHeight + 4, 2, 2, 'F');
        doc.setTextColor('#6B7280');
        doc.text(log.category, categoryX + 5, yPos);
      }

      yPos += lineHeight * 1.5;

      doc.setTextColor('#111827');
      doc.setFontSize(10);

      const messageLines = doc.splitTextToSize(log.message, maxLineWidth - 10);
      doc.text(messageLines, margin + 5, yPos);
      yPos += messageLines.length * lineHeight;

      if (log.details) {
        doc.setTextColor('#6B7280');
        doc.setFontSize(8);

        const detailsStr = JSON.stringify(log.details, null, 2);
        const detailsLines = doc.splitTextToSize(detailsStr, maxLineWidth - 15);

        doc.setFillColor('#F9FAFB');
        doc.roundedRect(margin + 5, yPos - 2, maxLineWidth - 10, detailsLines.length * lineHeight + 8, 1, 1, 'F');

        doc.text(detailsLines, margin + 10, yPos + 4);
        yPos += detailsLines.length * lineHeight + 10;
      }

      doc.setDrawColor('#E5E7EB');
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += lineHeight * 1.5;
    };

    filteredLogs.forEach((log) => {
      addLogEntry(log);
    });

    const totalPages = doc.internal.pages.length - 1;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor('#9CA3AF');

      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
        align: 'center',
      });

      doc.text('Generated by PocketApp', margin, doc.internal.pageSize.getHeight() - 10);

      const dateStr = new Date().toLocaleDateString();
      doc.text(dateStr, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    doc.save(`pocketapp-event-logs-${new Date().toISOString()}.pdf`);
    toast.success('Event logs exported successfully as PDF');
  } catch (error) {
    console.error('Failed to export PDF:', error);
    toast.error('Failed to export event logs as PDF');
  }
};

export const exportAsText = (filteredLogs: LogEntry[]) => {
  try {
    const textContent = filteredLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        let content = `[${timestamp}] ${log.level.toUpperCase()}: ${log.message}\n`;

        if (log.category) {
          content += `Category: ${log.category}\n`;
        }

        if (log.details) {
          content += `Details:\n${JSON.stringify(log.details, null, 2)}\n`;
        }

        return content + '-'.repeat(80) + '\n';
      })
      .join('\n');

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocketapp-event-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Event logs exported successfully as text file');
  } catch (error) {
    console.error('Failed to export text file:', error);
    toast.error('Failed to export event logs as text file');
  }
};
