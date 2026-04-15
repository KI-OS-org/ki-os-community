export function summarizeNotifications(items) {
  return {
    total: items.length,
    unread: items.filter(i => i.unread).length,
    critical: items.filter(i => i.level === 'critical').length,
  };
}
