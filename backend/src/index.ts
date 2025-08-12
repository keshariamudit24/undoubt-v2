import dotenv from 'dotenv'
import express from 'express';
import { PrismaClient } from '@prisma/client';
import doubtRouter from './routes/doubtRoutes';

dotenv.config()
const app = express();
const client = new PrismaClient()
const PORT = process.env.PORT || 4000;

// middlewares 
app.use(express.json());

// handle routes 
 app.use('/doubts', doubtRouter)

app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`)
})
