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
// In-memory room tracking: roomId -> Set of sockets
const rooms = new Map();
// Track socket to user mapping for cleanup
const socketUsers = new Map();
function broadcast(sockets, message) {
    if (sockets) {
        for (const clientSocket of sockets) {
            clientSocket.send(JSON.stringify(message));
        }
    }
}
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
                // add the user/socket in the in-memory mapping (roomId -> sockets)
                if (!rooms.has(parsedMsg.payload.roomId)) {
                    rooms.set(parsedMsg.payload.roomId, new Set());
                }
                rooms.get(parsedMsg.payload.roomId)?.add(socket);
                console.log(`Socket joined room ${parsedMsg.payload.roomId}`);
                const user = await client.users.findUnique({
                    where: { email: parsedMsg.payload.email }
                });
                if (!user)
                    return;
                // Store user info for this socket
                socketUsers.set(socket, {
                    userId: user.id,
                    email: parsedMsg.payload.email,
                    roomId: parsedMsg.payload.roomId
                });
                await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId
                    }
                });
                socket.send(JSON.stringify({
                    type: "system",
                    messageType: "success",
                    payload: { message: "Successfully joined the room" }
                }));
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
                if (!rooms.has(parsedMsg.payload.roomId)) {
                    rooms.set(parsedMsg.payload.roomId, new Set());
                }
                rooms.get(parsedMsg.payload.roomId)?.add(socket);
                // Store user info for this socket
                socketUsers.set(socket, {
                    userId: user.id,
                    email: parsedMsg.payload.email,
                    roomId: parsedMsg.payload.roomId
                });
                await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
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
                const sockets = rooms.get(parsedMsg.payload.roomId); // you get the set of all sockets present in that room 
                const message = {
                    type: "new doubt triggered",
                    payload: {
                        doubt: parsedMsg.payload.msg
                    }
                };
                if (sockets) {
                    broadcast(sockets, message);
                }
            }
            // ---------------> UPVOTE A DOUBT <-----------------
            if (parsedMsg.type == "upvote") {
                // find the doubt and update the upvotes by + 1
                await client.doubts.update({
                    where: {
                        id: parsedMsg.payload.doubtId,
                        room: parsedMsg.payload.rooomId
                    },
                    data: {
                        upvotes: {
                            increment: 1
                        }
                    }
                });
                // broadcast the upvotes to everyone in the room
                const sockets = rooms.get(parsedMsg.payload.roomId);
                const message = {
                    type: "upvote triggered",
                    payload: {
                        doubtId: parsedMsg.payload.doubtId
                    }
                };
                if (sockets) {
                    broadcast(sockets, message);
                }
                socket.send(JSON.stringify({
                    msg: "upvoted successfully"
                }));
            }
            // ---------------> DOWNVOTE A DOUBT <-----------------
            if (parsedMsg.type == "downvote") {
                // find the doubt and update the upvotes by - 1
                await client.doubts.update({
                    where: {
                        id: parsedMsg.payload.doubtId,
                        room: parsedMsg.payload.rooomId
                    },
                    data: {
                        upvotes: {
                            decrement: 1
                        }
                    }
                });
                // broadcast the upvotes to everyone in the room
                const sockets = rooms.get(parsedMsg.payload.roomId);
                const message = {
                    type: "downvote triggered",
                    payload: {
                        doubtId: parsedMsg.payload.doubtId
                    }
                };
                if (sockets) {
                    broadcast(sockets, message);
                }
                socket.send(JSON.stringify({
                    msg: "downvoted successfully"
                }));
            }
            // ---------------> LEAVE ROOM <-----------------
            if (parsedMsg.type == "leave") {
                rooms.get(parsedMsg.payload.roomId)?.delete(socket);
                socket.send(JSON.stringify({
                    msg: "user left the room"
                }));
            }
            // ---------------> CLOSE ROOM <-----------------
            if (parsedMsg.type == "close") {
                await client.doubts.deleteMany({
                    where: { room: parsedMsg.payload.roomId }
                });
                rooms.delete(parsedMsg.payload.roomId);
                socket.send(JSON.stringify({
                    msg: "room closed"
                }));
            }
        }
        catch (error) {
            socket.send(JSON.stringify({
                type: "error",
                payload: { message: error.message || "Invalid message format" }
            }));
        }
    });
    socket.on("close", () => {
        // triggers when there's any network error, user closes the tab,, user refreshes the site
        // need to write clean-up logic 
        const users = socketUsers.get(socket);
        socketUsers.delete(socket);
        if (users?.roomId) {
            rooms.get(users.roomId)?.delete(socket);
        }
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
// {
//   "type": "upvote/downvote",
//   "payload": {
//     "roomId": "abc123",
//     "doubtId": 42
//   }
// }
//# sourceMappingURL=ws.js.map