// Format currency values
export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// Get unique values from array
export function getUniqueValues<T>(arr: T[], key?: keyof T): string[] {
  if (key) {
    return Array.from(new Set(arr.map(item => String(item[key] || '')).filter(Boolean)));
  }
  return Array.from(new Set(arr.map(item => String(item)).filter(Boolean)));
}

