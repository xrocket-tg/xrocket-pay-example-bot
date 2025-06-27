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
    
    // Convert to string with maximum precision, explicitly using dots
    const numStr = parsedNum.toFixed(maxDecimals);
    
    // Remove trailing zeros and decimal point if all zeros
    // Ensure we use dots for decimal separators
    return numStr.replace(/\.?0+$/, '').replace(',', '.');
}

/**
 * Formats a number for currency display (removes trailing zeros, shows up to 8 decimals)
 * @param num - The number to format
 * @returns Formatted currency string
 */
export function formatCurrency(num: number | string): string {
    const formatted = formatNumberClean(num, 8);
    // Ensure we use dots for decimal separators regardless of locale
    return formatted.replace(',', '.');
}

/**
 * Formats a Date object as DD/MM/YYYY
 */
export function formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
} 