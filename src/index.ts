import 'dotenv/config';   // <-- simple, loads .env immediately
import { logger } from './utils/logger';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';

// Import routes
import appsRouter from './routes/apps';
import chatsRouter from './routes/chats';
import filesRouter from './routes/files';
import gitRouter from './routes/git';
import settingsRouter from './routes/settings';
import providersRouter from './routes/providers';
import streamRouter from './routes/stream';
import containerRouter from './routes/container';
import containerLogsRouter from './routes/container-logs';
import authRouter from './routes/auth';
import previewRouter from './routes/preview';

// Import services
import { ContainerLifecycleService } from './services/container_lifecycle_service';
import { ProvidersService } from './services/providers_service';
import { requireAuth } from './middleware/auth.middleware';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(helmet());

app.options("*", cors());
app.use(cookieParser());
app.use(helmet());
app.use(rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS ? Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX ? Number.parseInt(process.env.RATE_LIMIT_MAX, 10) : 500, // limit each IP to 100 requests per windowMs
    standardHeaders: true, 
    legacyHeaders: false, 
}));

// Default payload size limit: 2mb
app.use(express.json({ limit: process.env.DEFAULT_LIMIT ? `${process.env.DEFAULT_LIMIT}` : '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.DEFAULT_LIMIT ? `${process.env.DEFAULT_LIMIT}` : '10mb' }));

// Attachment routes: allow up to 10mb
app.use(['/api/files', '/api/attachments', '/api/upload'], express.json({ limit: process.env.ATTACHMENT_SIZE_LIMIT_MB ? `${process.env.ATTACHMENT_SIZE_LIMIT_MB}` : '50mb' }));
app.use(['/api/files', '/api/attachments', '/api/upload'], express.urlencoded({ extended: true, limit: process.env.ATTACHMENT_SIZE_LIMIT_MB ? `${process.env.ATTACHMENT_SIZE_LIMIT_MB}` : '50mb' }));
// Request logging
app.use((req, res, next) => {
  logger.info('HTTP Request', { service: 'http', method: req.method, path: req.path });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0' 
  });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Dyad API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/apps', appsRouter);
app.use('/api/apps', containerRouter); // Container routes for /api/apps/:appId/run, /api/apps/:appId/stop, etc.
app.use('/api/container', requireAuth,containerRouter); // Also mount at /api/container for /api/container/status
app.use('/api/container-logs', requireAuth,containerLogsRouter); // Container log streaming
app.use('/api/chats', requireAuth,chatsRouter);
app.use('/api/auth', authRouter);
app.use('/api/files',requireAuth, filesRouter);
app.use('/api/git',requireAuth, gitRouter);
app.use('/api/settings',requireAuth, settingsRouter);
app.use('/api/stream',requireAuth, streamRouter);
app.use('/api/providers', requireAuth, providersRouter);

// Preview route (not under /api prefix)
app.use('/', previewRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path 
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize and start lifecycle service for container management
const lifecycleService = ContainerLifecycleService.getInstance();

// Start server with async initialization
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize lifecycle service (discovers existing containers)
    await lifecycleService.initialize();
    
    // Start the cleanup loop
    await lifecycleService.start();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info('Dyad Backend Server Started', {
        service: 'http',
        port: PORT,
        httpApi: `http://localhost:${PORT}`,
        sseStream: `http://localhost:${PORT}/api/stream/chat`,
        health: `http://localhost:${PORT}/health`,
        apiDocs: `http://localhost:${PORT}/api-docs`,
        environment: process.env.NODE_ENV || 'development',
        database: process.env.DATABASE_PATH || './data/dyad.db',
        dataDir: process.env.DATA_DIR || './data/apps',
        containerization: process.env.CONTAINERIZATION_ENABLED === 'true' ? 'Enabled' : 'Disabled',
        containerEngine: process.env.CONTAINERIZATION_ENGINE || 'docker'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error, { service: 'http' });
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`, { service: 'http' });
  
  try {
    // Stop the lifecycle manager cleanup loop
    lifecycleService.stop();
    
    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed', { service: 'http' });
        resolve();
      });
    });
    
    logger.info('Graceful shutdown complete', { service: 'http' });
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error, { service: 'http' });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
