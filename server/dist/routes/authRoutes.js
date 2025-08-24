"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const client_1 = require("@prisma/client");
const authRouter = express_1.default.Router();
const client = new client_1.PrismaClient();
authRouter.post('/signin', (0, express_async_handler_1.default)(async (req, res) => {
    const { name, email } = req.body;
    console.log(name);
    console.log(email);
    if (!name || !email) {
        res.status(400).json({
            error: "Name and email are required"
        });
        return;
    }
    try {
        // Check if user already exists
        let user = await client.users.findUnique({
            where: { email }
        });
        if (!user) {
            // Create new user if doesn't exist
            user = await client.users.create({
                data: {
                    name,
                    email
                }
            });
        }
        res.status(200).json({
            msg: "user signed in successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    }
    catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            error: "Failed to sign in user"
        });
    }
}));
exports.default = authRouter;
//# sourceMappingURL=authRoutes.js.map