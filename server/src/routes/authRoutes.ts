import express from 'express'
import expressAsyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client'

const authRouter = express.Router()
const client = new PrismaClient();

authRouter.post('/signin', expressAsyncHandler(async (req, res) => {
    const { name, email } = req.body
    console.log(name)
    console.log(email)
    if (!name || !email) {
        res.status(400).json({
            error: "Name and email are required"
        })
        return
    }

    try {
        // Check if user already exists
        let user = await client.users.findUnique({
            where: { email }
        })

        if (!user) {
            // Create new user if doesn't exist
            user = await client.users.create({
                data: {
                    name,
                    email
                }
            })
        }

        res.status(200).json({
            msg: "user signed in successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        console.error('Database error:', error)
        res.status(500).json({
            error: "Failed to sign in user"
        })
    }
}))

export default authRouter