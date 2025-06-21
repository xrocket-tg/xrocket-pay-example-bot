/**
 * Currency management system for handling internal and external currency codes
 */

/**
 * Internal currency codes used throughout the application
 */
export type InternalCurrency = 'TON' | 'USDT' | 'XROCK';

/**
 * External currency codes used by xRocket Pay API
 */
export type ExternalCurrency = 'TONCOIN' | 'USDT' | 'XROCK';

/**
 * Currency configuration with all necessary metadata
 */
export interface CurrencyConfig {
    /** Internal currency code used in the application */
    readonly internalCode: InternalCurrency;
    /** External currency code used by xRocket Pay API */
    readonly externalCode: ExternalCurrency;
    /** Display emoji for the currency */
    readonly emoji: string;
    /** Display name for the currency */
    readonly name: string;
    /** Number of decimal places for precision */
    readonly decimals: number;
}

/**
 * Supported currencies configuration
 */
export const CURRENCIES: Record<InternalCurrency, CurrencyConfig> = {
    TON: {
        internalCode: 'TON',
        externalCode: 'TONCOIN',
        emoji: '💎',
        name: 'TON',
        decimals: 9
    },
    USDT: {
        internalCode: 'USDT',
        externalCode: 'USDT',
        emoji: '💵',
        name: 'USDT',
        decimals: 6
    },
    XROCK: {
        internalCode: 'XROCK',
        externalCode: 'XROCK',
        emoji: '🚀',
        name: 'XROCK',
        decimals: 8
    }
} as const;

/**
 * Currency converter utility class
 */
export class CurrencyConverter {
    /**
     * Converts internal currency code to external currency code
     */
    public static toExternal(internalCode: InternalCurrency): ExternalCurrency {
        return CURRENCIES[internalCode].externalCode;
    }

    /**
     * Converts external currency code to internal currency code
     */
    public static toInternal(externalCode: ExternalCurrency): InternalCurrency {
        const currency = Object.values(CURRENCIES).find(c => c.externalCode === externalCode);
        if (!currency) {
            throw new Error(`Unknown external currency code: ${externalCode}`);
        }
        return currency.internalCode;
    }

    /**
     * Gets currency configuration by internal code
     */
    public static getConfig(internalCode: InternalCurrency): CurrencyConfig {
        return CURRENCIES[internalCode];
    }

    /**
     * Gets currency configuration by external code
     */
    public static getConfigByExternal(externalCode: ExternalCurrency): CurrencyConfig {
        const internalCode = this.toInternal(externalCode);
        return this.getConfig(internalCode);
    }

    /**
     * Validates if a currency code is supported internally
     */
    public static isSupportedInternal(code: string): code is InternalCurrency {
        return code in CURRENCIES;
    }

    /**
     * Validates if a currency code is supported externally
     */
    public static isSupportedExternal(code: string): code is ExternalCurrency {
        return Object.values(CURRENCIES).some(c => c.externalCode === code);
    }

    /**
     * Gets all supported internal currency codes
     */
    public static getSupportedInternalCodes(): InternalCurrency[] {
        return Object.keys(CURRENCIES) as InternalCurrency[];
    }

    /**
     * Gets all supported external currency codes
     */
    public static getSupportedExternalCodes(): ExternalCurrency[] {
        return Object.values(CURRENCIES).map(c => c.externalCode);
    }
} 