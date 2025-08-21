"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const doubtRoutes_1 = __importDefault(require("./routes/doubtRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const client = new client_1.PrismaClient();
const PORT = process.env.PORT || 4000;
// middlewares 
app.use(express_1.default.json());
// handle routes 
app.use('/doubts', doubtRoutes_1.default);
app.use('/auth', authRoutes_1.default);
app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map