import winston from 'winston';

// Define the logger configuration
const logger = winston.createLogger({
  level: process.env.JUDGMENT_LOG_LEVEL || 'info', // Default to 'info', allow override via env var
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Simple format: Timestamp [LEVEL]: message {meta}
      let metaString = '';
      if (Object.keys(meta).length > 0) {
        try {
          // Attempt to stringify metadata, handle potential circular references
          metaString = ` ${JSON.stringify(meta, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              // Basic check for circular reference, might need refinement
              if (key === '') return value; // Root object
              if (metaString.includes(JSON.stringify(value))) return '[Circular]';
            }
            return value;
          })}`;
        } catch (error) {
          metaString = ' [Meta stringify error]';
        }
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
    }),
    winston.format.colorize({ all: true }) // Optional: Add colors
  ),
  transports: [
    // Log to the console
    new winston.transports.Console(),
    // Future enhancement: Add file transport
    // new winston.transports.File({ filename: 'judgeval.log' })
  ],
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.Console()
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  // Handle promise rejections
  rejectionHandlers: [
    new winston.transports.Console()
    // new winston.transports.File({ filename: 'rejections.log' })
  ]
});

export default logger; 