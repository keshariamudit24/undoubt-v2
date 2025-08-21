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
    const { roomId } = req.body;
    const userDoubts = await client.doubts.findMany({
        where: {
            room: roomId
        }
    });
    console.log(userDoubts);
    res.status(200).json({
        msg: "fetched all the doubts",
        doubts: userDoubts
    });
}));
exports.default = doubtRouter;
//# sourceMappingURL=doubtRoutes.js.map