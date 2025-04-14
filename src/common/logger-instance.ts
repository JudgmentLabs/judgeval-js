import winston from 'winston';

// Define the logger configuration
const isProduction = process.env.NODE_ENV === 'production';
// Removed forceConsoleLog as `silent` option handles production override

const logger = winston.createLogger({
  // Set silent: true in production to completely disable logging regardless of level or transports
  silent: isProduction,

  // Level setting only matters when not silent (i.e., in development)
  level: process.env.JUDGMENT_LOG_LEVEL || 'info', // Default to 'info' in dev

  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Simple format: Timestamp [LEVEL]: message {meta}
      let metaString = '';
      // Only attempt to stringify meta if it's not empty
      if (meta && Object.keys(meta).length > 0) {
        try {
          // Use a basic stringify, handle potential errors (like circular refs)
          metaString = ` ${JSON.stringify(meta)}`;
        } catch (error) {
          // Log a simple indicator if stringify fails
          metaString = ' [Meta stringify error]';
        }
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
    }),
    winston.format.colorize({ all: true }) // Optional: Add colors
  ),

  // Transports are only added if not in production (since silent: true handles production)
  transports: [
    ...(!isProduction ? [new winston.transports.Console()] : []),
    // Future enhancement: Add file transport
    // new winston.transports.File({ filename: 'judgeval.log' })
  ],
  // Exception handlers only added if not in production
  exceptionHandlers: [
    ...(!isProduction ? [new winston.transports.Console()] : []),
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  // Rejection handlers only added if not in production
  rejectionHandlers: [
    ...(!isProduction ? [new winston.transports.Console()] : []),
    // new winston.transports.File({ filename: 'rejections.log' })
  ]
});

export default logger; 