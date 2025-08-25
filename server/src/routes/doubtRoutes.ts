import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client'

const doubtRouter = express.Router()
const client = new PrismaClient();

doubtRouter.get('/get-all', expressAsyncHandler(async (req, res) => {
    const { roomId } = req.query;

    if (!roomId || typeof roomId !== 'string') {
        res.status(400).json({
            error: "Room ID is required"
        });
    }

    try {
        const userDoubts = await client.doubts.findMany({
            where: {
                room: roomId as string,
                doubt: {
                    not: null // Only get doubts that have actual doubt text (not just room membership entries)
                }
            },
            include: {
                user: {
                    select: {
                        email: true
                    }
                }
            },
            orderBy: {
                id: 'asc' // Order by creation time (oldest first)
            }
        })

        console.log(`Fetched ${userDoubts.length} doubts for room ${roomId}`)

        res.status(200).json({
            msg: "fetched all the doubts",
            doubts: userDoubts
        });
    } catch (error) {
        console.error('Error fetching doubts:', error);
        res.status(500).json({
            error: "Failed to fetch doubts"
        });
    }
}))


export default doubtRouter;