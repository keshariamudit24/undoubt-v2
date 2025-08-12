import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client'

const doubtRouter = express.Router()
const client = new PrismaClient();

doubtRouter.get('/get-all', expressAsyncHandler(async (req, res) => {
    const { email, roomId } = req.body;
    const user = await client.users.findUnique({
        where: {
            email: email
        }
    })
    const whereClause: any = { room: roomId };
    if(user?.id !== undefined) {
        whereClause.user_id = user.id;
    }
    const userDoubts = await client.doubts.findMany({
        where: whereClause
    })

    console.log(userDoubts)

    res.status(200).json({
        msg: "fetched all the doubts",
        doubts: userDoubts
    })
}))

export default doubtRouter;
