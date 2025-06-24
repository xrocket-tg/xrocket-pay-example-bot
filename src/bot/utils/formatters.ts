/**
 * Formats a number to 2 decimal places
 */
export function formatNumber(num: number | string): string {
    const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
    return parsedNum.toFixed(2);
}

/**
 * Formats a number and removes trailing zeros for cleaner display
 * @param num - The number to format
 * @param maxDecimals - Maximum number of decimal places (default: 8)
 * @returns Formatted number string without trailing zeros
 */
export function formatNumberClean(num: number | string, maxDecimals: number = 8): string {
    const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
    
    if (isNaN(parsedNum)) {
        return '0';
    }
    
    // Convert to string with maximum precision
    const numStr = parsedNum.toFixed(maxDecimals);
    
    // Remove trailing zeros and decimal point if all zeros
    return numStr.replace(/\.?0+$/, '');
}

/**
 * Formats a number for currency display (removes trailing zeros, shows up to 8 decimals)
 * @param num - The number to format
 * @returns Formatted currency string
 */
export function formatCurrency(num: number | string): string {
    return formatNumberClean(num, 8);
} 