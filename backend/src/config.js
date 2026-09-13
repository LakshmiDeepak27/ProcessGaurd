import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../data/processguard.sqlite'),
  ENGINE_BINARY_PATH: process.env.ENGINE_PATH || (
    process.platform === 'win32'
      ? path.resolve(__dirname, '../../agent/processguard_engine.exe')
      : path.resolve(__dirname, '../../agent/build/processguard_engine')
  ),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  SAMPLING_INTERVAL_MS: parseInt(process.env.SAMPLING_INTERVAL_MS || '350', 10),
  MAX_PROCESSES: parseInt(process.env.MAX_PROCESSES || '150', 10),
};
