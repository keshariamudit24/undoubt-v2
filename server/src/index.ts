import dotenv from 'dotenv'
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import doubtRouter from './routes/doubtRoutes';
import authRouter from './routes/authRoutes';

dotenv.config()
const app = express();
const client = new PrismaClient()
const PORT = process.env.PORT || 3000;

// middlewares
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// handle routes
 app.use('/doubts', doubtRouter)
 app.use('/auth', authRouter)

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
    console.log(`CORS enabled for: http://localhost:5173, http://localhost:5174`)
})

// Keep the process alive and handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});