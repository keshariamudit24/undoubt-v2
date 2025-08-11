"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables first
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
const client = new client_1.PrismaClient();
const wss = new ws_1.WebSocketServer({ port: 8080 });
wss.on("connection", (socket) => {
    console.log("connection established");
    // server gets msg from client
    socket.on("message", async (msg) => {
        try {
            // parse it into JSON because we get Buffer object by default 
            const parsedMsg = JSON.parse(msg.toString());
            // ---------------> JOIN ROOM <-----------------
            if (parsedMsg.type == "join") {
                // check if room exists
                // if it does, add the person to the room
                // else invalid room id
                const room = await client.doubts.findFirst({
                    where: {
                        room: parsedMsg.payload.roomId
                    }
                });
                if (!room) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { msg: "Invalid room Id" }
                    }));
                    return;
                }
                const user = await client.users.findUnique({
                    where: { email: parsedMsg.payload.email }
                });
                if (!user)
                    return;
                await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
                        doubt: ""
                    }
                });
            }
            // ---------------> CREATE ROOM <-----------------
            if (parsedMsg.type == "create") {
                // just create a room in with this user in the doubts table
                // this makes sure a user can "join" a room only if it has been "created" by someone  
                const user = await client.users.findUnique({
                    where: {
                        email: parsedMsg.payload.email
                    }
                });
                if (!user)
                    return;
                await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
                        doubt: ""
                    }
                });
            }
            // ---------------> ASK DOUBT <-----------------
            if (parsedMsg.type == "ask-doubt") {
                // a user sends a doubt
                // store the doubt in db
                // check if the user exists in the doubts table
                const user = await client.users.findUnique({
                    where: {
                        email: parsedMsg.payload.email
                    }
                });
                if (!user)
                    return;
                const currUser = await client.doubts.findFirst({
                    where: {
                        user_id: user.id,
                    }
                });
                if (!currUser)
                    return;
                // store in db
                await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
                        doubt: parsedMsg.payload.msg
                    }
                });
                // broadcast that doubt to everyone present in the room 
                const doubtRows = await client.doubts.findMany();
                console.log(doubtRows);
                for (const i in doubtRows) {
                    const doubtObj = doubtRows[i];
                }
            }
            // ---------------> LEAVE ROOM <-----------------
            if (parsedMsg.type == "leave") {
            }
        }
        catch (error) {
            socket.send(JSON.stringify({
                type: "error",
                payload: { message: error.message || "Invalid message format" }
            }));
        }
    });
    // close the connection 
    socket.on("close", () => {
    });
});
// "msg" breakdown 
// {
//     "type": "join",
//     "payload": {
// 		   "email": "abc@gmail.com"
//         "roomId": "123"
//     }
// }
// {
//     "type": "ask-doubt",
//     "payload": {
//		   "email": "abc@gmail.com",
//		   "roomId": "abc123",
//         "msg": "hi there"
//     }
// }
// {
//     "type": "create",
//     "payload": {
//          "email": "abc@gmail.com",
//			"roomId" "123"
//     }
// }
//# sourceMappingURL=ws.js.map