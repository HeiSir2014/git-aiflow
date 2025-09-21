import { logger, shutdownLogger } from '../logger.js';

export const processExit = async (code: number = 0, error?: Error | any) => {
  if (error) {
    logger.error('❌ Error:', error);
  }
  await shutdownLogger();
  process.exit(code);
};
