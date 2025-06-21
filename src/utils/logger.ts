import { createLogger, format, transports } from 'winston';

/**
 * Safely stringify an object, handling circular references
 */
function safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
        }
        return value;
    });
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`;
        })
    ),
    transports: [
        new transports.Console()
    ]
});

export default logger; 