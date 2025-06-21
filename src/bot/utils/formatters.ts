/**
 * Formats a number to 2 decimal places
 */
export function formatNumber(num: number | string): string {
    const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
    return parsedNum.toFixed(2);
} 