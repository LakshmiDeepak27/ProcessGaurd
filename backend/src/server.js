import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { initDatabase } from './database/db.js';
import { engineService } from './services/engineService.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (CONFIG.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount API routes
app.use('/api', apiRouter);

// Serve Frontend Static Bundle in Production
const possibleFrontendPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../public'),
];

let frontendDist = null;
for (const p of possibleFrontendPaths) {
  if (fs.existsSync(p)) {
    frontendDist = p;
    break;
  }
}

if (frontendDist) {
  console.log(`[Server] Serving production frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 Handler for APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route '${req.originalUrl}' not found.` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Bootstrap server
export async function startServer(port = CONFIG.PORT) {
  try {
    // 1. Initialize SQLite Database
    await initDatabase();
    console.log(`[Database] SQLite initialized at ${CONFIG.DB_PATH}`);

    // 2. Start C++ monitoring engine background polling
    engineService.startBackgroundPolling();

    // 3. Start Express HTTP Server
    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        console.log(`====================================================`);
        console.log(`  ProcessGuard API Server running on port ${port}`);
        console.log(`  Health Check: http://localhost:${port}/api/health`);
        console.log(`  System Info:  http://localhost:${port}/api/system`);
        console.log(`  Processes:    http://localhost:${port}/api/processes`);
        console.log(`  Alerts:       http://localhost:${port}/api/alerts`);
        console.log(`====================================================`);
        resolve({ server, app });
      });
    });
  } catch (err) {
    console.error(`[Server] Fatal bootstrap error: ${err.message}`);
    process.exit(1);
  }
}

// Automatically start if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default app;
