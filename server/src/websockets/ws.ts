import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import dotenv from "dotenv";
import path from "path";

// Load environment variables first
dotenv.config({ path: path.join(__dirname, "../../.env") });

const client = new PrismaClient();
const wss = new WebSocketServer({ port: 8080 });

// In-memory room tracking: roomId -> Set of sockets
const rooms = new Map<string, Set<WebSocket>>();
// Track socket to user mapping for cleanup user/socket -> details
const socketUsers = new Map<WebSocket, { userId: number, email: string, roomId?: string }>();
// Track room admins: roomId -> admin email
const roomAdmins = new Map<string, string>();


interface Msg {
  type: string;
  payload: {
    doubtId: number;
  };
}

interface NewMsg {
  type: string;
  payload: {
    doubt: string;
    userEmail?: string;
    doubtId?: number;
  };
}

function broadcast(sockets: Set<WebSocket>, message: any){
	if(sockets){
		for(const clientSocket of sockets){
			clientSocket.send(JSON.stringify(message));
		}
	}
}

wss.on("connection", (socket) => {
	console.log("connection established")
	// server gets msg from client
	socket.on("message", async (msg) => {
		try {
			// parse it into JSON because we get Buffer object by default 
			const parsedMsg = JSON.parse(msg.toString());
			
			// ---------------> JOIN ROOM <-----------------
			if(parsedMsg.type == "join"){
				// check if room exists
				// if it does, add the person to the room
				// else invalid room id
				const room = await client.doubts.findFirst({
					where: {
						room: parsedMsg.payload.roomId
					}
				})

				if(!room){
					socket.send(JSON.stringify({
						type: "error",
						payload: { msg: "Invalid room Id" }
					}))
					return;
				}

				// add the user/socket in the in-memory mapping (roomId -> sockets)
				if(!rooms.has(parsedMsg.payload.roomId)){
					rooms.set(parsedMsg.payload.roomId, new Set());
				}
				rooms.get(parsedMsg.payload.roomId)?.add(socket);

				console.log(`Socket joined room ${parsedMsg.payload.roomId}`);

				const user = await client.users.findUnique({
					where: { email: parsedMsg.payload.email }
				});

				if(!user) return;

				// Store user info for this socket
				socketUsers.set(socket, {
					userId: user.id,
					email: parsedMsg.payload.email,
					roomId: parsedMsg.payload.roomId
				});

				// Don't create a doubts entry just for joining - only create when asking doubts
				// The doubts table should only contain actual doubts, not room memberships

				socket.send(JSON.stringify({
                    type: "system",
                    messageType: "success",
                    payload: { message: "Successfully joined the room" }
                }));
			}

			// ---------------> CHECK ADMIN <-----------------
			if(parsedMsg.type == "check-admin"){
				// Check if user is admin of the room
				const isAdmin = roomAdmins.get(parsedMsg.payload.roomId) === parsedMsg.payload.email;

				socket.send(JSON.stringify({
					type: "admin-status",
					payload: { isAdmin }
				}));
			}

			// ---------------> CREATE ROOM <-----------------
			if(parsedMsg.type == "create"){
				// just create a room in with this user in the doubts table
				// this makes sure a user can "join" a room only if it has been "created" by someone  
				const user = await client.users.findUnique({
					where: {
						email: parsedMsg.payload.email
					}
				})
				if(!user) return;
				
				if(!rooms.has(parsedMsg.payload.roomId)){
					rooms.set(parsedMsg.payload.roomId, new Set());
				}
				rooms.get(parsedMsg.payload.roomId)?.add(socket);

				// Store user info for this socket
				socketUsers.set(socket, {
					userId: user.id,
					email: parsedMsg.payload.email,
					roomId: parsedMsg.payload.roomId
				});

				// Track this user as the room admin
				roomAdmins.set(parsedMsg.payload.roomId, parsedMsg.payload.email);

				await client.doubts.create({
					data: {
						user_id: user.id,
						room: parsedMsg.payload.roomId,
					}
				})

				// Send success message
				socket.send(JSON.stringify({
                    type: "system",
                    messageType: "success",
                    payload: { message: "Room created successfully" }
                }));

				// Immediately send admin status confirmation
				socket.send(JSON.stringify({
					type: "admin-status",
					payload: { isAdmin: true }
				}));
			}

			// ---------------> ASK DOUBT <-----------------
			if(parsedMsg.type == "ask-doubt"){
				// a user sends a doubt
				// store the doubt in db
				// check if the user exists in the users table
				const user = await client.users.findUnique({
					where: {
						email: parsedMsg.payload.email
					}
				});
				if (!user) {
					return;
				}

				// Check if the user is in the room (from socket mapping)
				const userSocket = socketUsers.get(socket);
				if (!userSocket || userSocket.roomId !== parsedMsg.payload.roomId) {
					socket.send(JSON.stringify({
						type: "error",
						payload: { msg: "You are not in this room" }
					}));
					return;
				}

				// store in db
				const createdDoubt = await client.doubts.create({
					data: {
						user_id: user.id,
						room: parsedMsg.payload.roomId,
						doubt: parsedMsg.payload.msg
					}
				})

				// broadcast that doubt to everyone present in the room
				const sockets = rooms.get(parsedMsg.payload.roomId) // you get the set of all sockets present in that room

				const message: NewMsg = {
					type: "new doubt triggered",
					payload: {
						doubt: parsedMsg.payload.msg,
						userEmail: parsedMsg.payload.email, // Include user email in broadcast
						doubtId: createdDoubt.id // Include the actual database ID
					}
				}

				if(sockets) {
					broadcast(sockets, message)
				}
			}

			// ---------------> UPVOTE A DOUBT <-----------------
			if(parsedMsg.type == "upvote"){
				// find the doubt and update the upvotes by + 1
				await client.doubts.update({
					where: {
						id: parsedMsg.payload.doubtId
					},
					data: {
						upvotes: {
							increment: 1
						}
					}
				})

				// broadcast the upvotes to everyone in the room
				const sockets = rooms.get(parsedMsg.payload.roomId)
				const message: Msg = {
					type: "upvote triggered",
					payload: {
						doubtId: parsedMsg.payload.doubtId 
					}
				}
				if (sockets) {
					broadcast(sockets, message)
				}

				socket.send(JSON.stringify({
					msg: "upvoted successfully"
				}))
			}

			// ---------------> DOWNVOTE A DOUBT <-----------------
			if(parsedMsg.type == "downvote"){
				// find the doubt and update the upvotes by - 1
				await client.doubts.update({
					where: {
						id: parsedMsg.payload.doubtId
					},
					data: {
						upvotes: {
							decrement: 1
						}
					}
				})

				// broadcast the downvotes to everyone in the room
				const sockets = rooms.get(parsedMsg.payload.roomId)
				const message: Msg = {
					type: "downvote triggered",
					payload: {
						doubtId: parsedMsg.payload.doubtId 
					}
				}
				if (sockets) {
					broadcast(sockets, message)
				}

				socket.send(JSON.stringify({
					msg: "downvoted successfully"
				}))
			}

			// ---------------> LEAVE ROOM <-----------------
			if(parsedMsg.type == "leave"){
				
				rooms.get(parsedMsg.payload.roomId)?.delete(socket)

				socket.send(JSON.stringify({
					msg: "user left the room"
				}))
			}

			// ---------------> CLOSE ROOM <-----------------
			if(parsedMsg.type == "close"){
				await client.doubts.deleteMany({
					where: { room: parsedMsg.payload.roomId }
				})

				rooms.delete(parsedMsg.payload.roomId);

				socket.send(JSON.stringify({
					msg: "room closed"
				}))
			}

		} catch (error: any) {
			socket.send(JSON.stringify({
				type: "error",
				payload: { message: error.message || "Invalid message format" }
			}));
		}
	})
	socket.on("close", () => {
		// triggers when there's any network error, user closes the tab,, user refreshes the site
		// need to write clean-up logic 
		const users = socketUsers.get(socket)
		socketUsers.delete(socket)
		if (users?.roomId) {
			rooms.get(users.roomId)?.delete(socket);
		}
	})
})

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