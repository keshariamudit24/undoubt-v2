"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const client_1 = require("@prisma/client");
const doubtRouter = express_1.default.Router();
const client = new client_1.PrismaClient();
doubtRouter.get('/get-all', (0, express_async_handler_1.default)(async (req, res) => {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
        res.status(400).json({
            error: "Room ID is required"
        });
    }
    try {
        const userDoubts = await client.doubts.findMany({
            where: {
                room: roomId,
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
        });
        console.log(`Fetched ${userDoubts.length} doubts for room ${roomId}`);
        res.status(200).json({
            msg: "fetched all the doubts",
            doubts: userDoubts
        });
    }
    catch (error) {
        console.error('Error fetching doubts:', error);
        res.status(500).json({
            error: "Failed to fetch doubts"
        });
    }
}));
doubtRouter.get('/answered', (0, express_async_handler_1.default)(async (req, res) => {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
        res.status(400).json({
            error: "Room ID is required"
        });
        return;
    }
    try {
        const answeredDoubts = await client.doubts.findMany({
            where: {
                room: roomId,
                answered: true
            },
            include: {
                user: {
                    select: {
                        email: true
                    }
                }
            },
            orderBy: {
                id: 'asc'
            }
        });
        res.status(200).json({
            msg: "fetched answered doubts",
            doubts: answeredDoubts
        });
    }
    catch (error) {
        console.error('Error fetching answered doubts:', error);
        res.status(500).json({
            error: "Failed to fetch answered doubts"
        });
    }
}));
exports.default = doubtRouter;
//# sourceMappingURL=doubtRoutes.js.map