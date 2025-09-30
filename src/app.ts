import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { testConnection, initializeDatabase } from './database/connection';
import { DataLoader } from './services/dataLoader';
import { ScheduleController } from './controllers/scheduleController';
import { setupSwagger } from './config/swagger';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize controller
const scheduleController = new ScheduleController();

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.get('/health', (req, res) => scheduleController.getHealth(req, res));
app.get('/full-plan', (req, res) => scheduleController.getFullPlan(req, res));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting MCAT Study Schedule Planner...');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Initialize database schema
    await initializeDatabase();
    
    // Load Excel data if not already loaded
    const excelPath = path.join(__dirname, '../proj-docs/Organized_MCAT_Topics.xlsx');
    const dataLoader = new DataLoader(excelPath);
    await dataLoader.loadAllData();

    // Start server
    app.listen(PORT, () => {
      console.log('');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📅 Full plan endpoint: http://localhost:${PORT}/full-plan`);
      console.log(`📚 API documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

startServer();
