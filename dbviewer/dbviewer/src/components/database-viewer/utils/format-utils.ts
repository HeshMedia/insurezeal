export const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export const getDataTypeColor = (dataType: string): string => {
  if (dataType.includes('varchar') || dataType.includes('text') || dataType.includes('char')) {
    return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300';
  }
  if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal')) {
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300';
  }
  if (dataType.includes('timestamp') || dataType.includes('date') || dataType.includes('time')) {
    return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300';
  }
  if (dataType.includes('boolean')) {
    return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
};