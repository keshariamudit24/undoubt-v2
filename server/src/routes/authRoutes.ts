import express from 'express'
import expressAsyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client'

const authRouter = express.Router()
const client = new PrismaClient();

authRouter.post('/signin', expressAsyncHandler(async (req, res) => {
    const { name, email } = req.body
    await client.users.create({
        data: {
            name, 
            email
        }
    })
    res.status(200).json({
        msg: "user signed in successfully"
    })
}))

export default authRouter