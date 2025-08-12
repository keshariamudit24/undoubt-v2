import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client'

const doubtRouter = express.Router()
const client = new PrismaClient();

doubtRouter.get('/get-all', expressAsyncHandler(async (req, res) => {
    const { roomId } = req.body;
    const userDoubts = await client.doubts.findMany({
        where: {
            room: roomId
        }
    })

    console.log(userDoubts)

    res.status(200).json({
        msg: "fetched all the doubts",
        doubts: userDoubts
    })
}))


export default doubtRouter;