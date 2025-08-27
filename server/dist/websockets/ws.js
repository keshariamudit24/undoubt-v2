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
// Track socket to user mapping for cleanup user/socket -> details
const socketUsers = new Map();
// Track room admins: roomId -> admin email
const roomAdmins = new Map();
// Track closed rooms to prevent new interactions
const closedRooms = new Set();
function broadcast(sockets, message) {
    if (sockets) {
        sockets.forEach((clientSocket) => {
            try {
                if (clientSocket.readyState === ws_1.WebSocket.OPEN) {
                    clientSocket.send(JSON.stringify(message));
                }
            }
            catch (e) {
                console.error(`Failed to send message to a client: ${e}`);
            }
        });
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
                // Check if room has been closed
                if (closedRooms.has(parsedMsg.payload.roomId)) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { msg: "This room has been closed by the admin." },
                    }));
                    return;
                }
                // check if room exists
                // if it does, add the person to the room
                // else invalid room id
                const room = await client.doubts.findFirst({
                    where: {
                        room: parsedMsg.payload.roomId,
                    },
                });
                if (!room) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { msg: "Invalid room Id" },
                    }));
                    return;
                }
                // add the user/socket in the in-memory mapping (roomId -> sockets)
                if (!rooms.has(parsedMsg.payload.roomId)) {
                    rooms.set(parsedMsg.payload.roomId, new Set());
                }
                rooms.get(parsedMsg.payload.roomId)?.add(socket);
                const user = await client.users.findUnique({
                    where: { email: parsedMsg.payload.email },
                });
                if (!user)
                    return;
                // Store user info for this socket
                socketUsers.set(socket, {
                    userId: user.id,
                    email: parsedMsg.payload.email,
                    roomId: parsedMsg.payload.roomId,
                });
                // Don't create a doubts entry just for joining - only create when asking doubts
                // The doubts table should only contain actual doubts, not room memberships
                socket.send(JSON.stringify({
                    type: "system",
                    messageType: "success",
                    payload: { message: "Successfully joined the room" },
                }));
            }
            // ---------------> CHECK ADMIN <-----------------
            if (parsedMsg.type == "check-admin") {
                // Check if user is admin of the room
                const isAdmin = roomAdmins.get(parsedMsg.payload.roomId) === parsedMsg.payload.email;
                socket.send(JSON.stringify({
                    type: "admin-status",
                    payload: { isAdmin },
                }));
            }
            // ---------------> CREATE ROOM <-----------------
            if (parsedMsg.type == "create") {
                // If a room is being re-created, remove it from the closed list
                if (closedRooms.has(parsedMsg.payload.roomId)) {
                    closedRooms.delete(parsedMsg.payload.roomId);
                }
                // just create a room in with this user in the doubts table
                // this makes sure a user can "join" a room only if it has been "created" by someone
                const user = await client.users.findUnique({
                    where: {
                        email: parsedMsg.payload.email,
                    },
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
                    roomId: parsedMsg.payload.roomId,
                });
                // Track this user as the room admin
                roomAdmins.set(parsedMsg.payload.roomId, parsedMsg.payload.email);
                // create a new entry only if there doesnt exist one already. This way we can prevent the creatation of new entries while reload
                let findAdmin = await client.doubts.findFirst({
                    where: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
                    },
                });
                if (findAdmin == undefined) {
                    await client.doubts.create({
                        data: {
                            user_id: user.id,
                            room: parsedMsg.payload.roomId,
                        },
                    });
                }
                // Send success message
                socket.send(JSON.stringify({
                    type: "system",
                    messageType: "success",
                    payload: { message: "Room created successfully" },
                }));
                // Immediately send admin status confirmation
                socket.send(JSON.stringify({
                    type: "admin-status",
                    payload: { isAdmin: true },
                }));
            }
            // ---------------> ASK DOUBT <-----------------
            if (parsedMsg.type == "ask-doubt") {
                // Check if room is closed before processing the doubt
                if (closedRooms.has(parsedMsg.payload.roomId)) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: {
                            msg: "This room has been closed and is no longer active.",
                        },
                    }));
                    return;
                }
                // a user sends a doubt
                // store the doubt in db
                // check if the user exists in the users table
                const user = await client.users.findUnique({
                    where: {
                        email: parsedMsg.payload.email,
                    },
                });
                if (!user) {
                    return;
                }
                // Check if the user is in the room (from socket mapping)
                const userSocket = socketUsers.get(socket);
                if (!userSocket || userSocket.roomId !== parsedMsg.payload.roomId) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { msg: "You are not in this room" },
                    }));
                    return;
                }
                // if the room has been closed, there will not be any field with this roomId, so just check once
                const roomExists = await client.doubts.findFirst({
                    where: {
                        room: parsedMsg.payload.roomId
                    }
                });
                if (roomExists == null) {
                    socket.send(JSON.stringify({
                        msg: "room is closed, please exit"
                    }));
                    return;
                }
                // store in db
                const createdDoubt = await client.doubts.create({
                    data: {
                        user_id: user.id,
                        room: parsedMsg.payload.roomId,
                        doubt: parsedMsg.payload.msg,
                    },
                });
                // broadcast that doubt to everyone present in the room
                const sockets = rooms.get(parsedMsg.payload.roomId); // you get the set of all sockets present in that room
                const message = {
                    type: "new doubt triggered",
                    payload: {
                        doubt: parsedMsg.payload.msg,
                        userEmail: parsedMsg.payload.email, // Include user email in broadcast
                        doubtId: createdDoubt.id, // Include the actual database ID
                    },
                };
                if (sockets) {
                    broadcast(sockets, message);
                }
            }
            // ---------------> UPVOTE A DOUBT <-----------------
            if (parsedMsg.type == "upvote") {
                // find the doubt and update the upvotes by + 1
                try {
                    await client.doubts.update({
                        where: {
                            id: parsedMsg.payload.doubtId,
                        },
                        data: {
                            upvotes: {
                                increment: 1,
                            },
                        },
                    });
                    // broadcast the upvotes to everyone in the room
                    const sockets = rooms.get(parsedMsg.payload.roomId);
                    if (sockets && sockets.size > 0) {
                        const message = {
                            type: "upvote triggered",
                            payload: {
                                doubtId: parsedMsg.payload.doubtId,
                            },
                        };
                        broadcast(sockets, message);
                    }
                    else {
                        console.log(`No sockets found for room ${parsedMsg.payload.roomId}`);
                    }
                    socket.send(JSON.stringify({
                        type: "success",
                        msg: "upvoted successfully",
                    }));
                }
                catch (error) {
                    console.error("Error updating upvotes:", error);
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "Failed to update upvotes" },
                    }));
                }
            }
            // ---------------> DOWNVOTE A DOUBT <-----------------
            if (parsedMsg.type == "downvote") {
                // find the doubt and update the upvotes by - 1
                try {
                    await client.doubts.update({
                        where: {
                            id: parsedMsg.payload.doubtId,
                        },
                        data: {
                            upvotes: {
                                decrement: 1,
                            },
                        },
                    });
                    // broadcast the downvotes to everyone in the room
                    const sockets = rooms.get(parsedMsg.payload.roomId);
                    if (sockets && sockets.size > 0) {
                        const message = {
                            type: "downvote triggered",
                            payload: {
                                doubtId: parsedMsg.payload.doubtId,
                            },
                        };
                        broadcast(sockets, message);
                    }
                    else {
                        console.log(`No sockets found for room ${parsedMsg.payload.roomId}`);
                    }
                    socket.send(JSON.stringify({
                        type: "success",
                        msg: "downvoted successfully",
                    }));
                }
                catch (error) {
                    console.error("Error updating downvotes:", error);
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "Failed to update downvotes" },
                    }));
                }
            }
            // ---------------> LEAVE ROOM <-----------------
            if (parsedMsg.type == "leave") {
                // Allow non-admin users to leave the room
                rooms.get(parsedMsg.payload.roomId)?.delete(socket);
                socket.send(JSON.stringify({
                    type: "success",
                    msg: "user left the room",
                }));
            }
            // ---------------> CLOSE ROOM <-----------------
            if (parsedMsg.type == "close") {
                try {
                    // CRITICAL: Verify that the user sending this message is the admin of the room.
                    const requestingUser = socketUsers.get(socket);
                    const adminEmail = roomAdmins.get(parsedMsg.payload.roomId);
                    if (!requestingUser || requestingUser.email !== adminEmail) {
                        socket.send(JSON.stringify({
                            type: "error",
                            payload: { msg: "Only the room admin can perform this action." },
                        }));
                        return; // Stop execution if not the admin
                    }
                    // Mark the room as closed immediately
                    closedRooms.add(parsedMsg.payload.roomId);
                    // First notify all users in the room that it's being closed
                    const roomSockets = rooms.get(parsedMsg.payload.roomId);
                    if (roomSockets && roomSockets.size > 0) {
                        console.log(`Notifying ${roomSockets.size} clients that room ${parsedMsg.payload.roomId} is closing`);
                        const closeMessage = {
                            type: "room-closed",
                            payload: {
                                message: "This room has been closed by the admin. Please exit.",
                            },
                        };
                        broadcast(roomSockets, closeMessage);
                    }
                    // Then delete all doubts from the database
                    await client.doubts.deleteMany({
                        where: {
                            room: parsedMsg.payload.roomId,
                        },
                    });
                    // Do not remove the room from memory, as users are still inside.
                    // They will leave manually.
                    // rooms.delete(parsedMsg.payload.roomId);
                    // roomAdmins.delete(parsedMsg.payload.roomId);
                    // The admin who sent the close command also receives the broadcast,
                    // so no special success message is needed for them.
                }
                catch (error) {
                    console.error("Error closing room:", error);
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "Failed to close room" },
                    }));
                }
            }
        }
        catch (error) {
            socket.send(JSON.stringify({
                type: "error",
                payload: { message: error.message || "Invalid message format" },
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