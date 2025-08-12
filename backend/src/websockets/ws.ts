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
// Track socket to user mapping for cleanup
const socketUsers = new Map<WebSocket, { userId: number, email: string, roomId?: string }>();
// user/socket -> details

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
			if(parsedMsg.type == "create"){
				// just create a room in with this user in the doubts table
				// this makes sure a user can "join" a room only if it has been "created" by someone  
				
				if(!rooms.has(parsedMsg.payload.roomId)){
					rooms.set(parsedMsg.payload.roomId, new Set());
				}
				rooms.get(parsedMsg.payload.roomId)?.add(socket);

				const user = await client.users.findUnique({
					where: {
						email: parsedMsg.payload.email
					}
				})
				if(!user) return;

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
				})
			}

			// ---------------> ASK DOUBT <-----------------
			if(parsedMsg.type == "ask-doubt"){
				// a user sends a doubt
				// store the doubt in db
				  // check if the user exists in the doubts table
				const user = await client.users.findUnique({
					where: {
						email: parsedMsg.payload.email
					}
				});
				if (!user) return;
				const currUser = await client.doubts.findFirst({
					where: {
						user_id: user.id,
					}
				});
				if(!currUser) return;
				// store in db
				await client.doubts.create({
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
						doubt: parsedMsg.payload.msg 
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
						id: parsedMsg.payload.doubtId,
						room: parsedMsg.payload.rooomId
					},
					data: {
						upvotes: {
							increment: 1
						}
					}
				})

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
						id: parsedMsg.payload.doubtId,
						room: parsedMsg.payload.rooomId
					},
					data: {
						upvotes: {
							decrement: 1
						}
					}
				})

				socket.send(JSON.stringify({
					msg: "upvoted successfully"
				}))
			}

		} catch (error: any) {
            socket.send(JSON.stringify({
                type: "error",
                payload: { message: error.message || "Invalid message format" }
            }));
        }
	})

	// close the connection 
	socket.on("close", async () => {
		try {
			const userInfo = socketUsers.get(socket);
			if (userInfo) {
				// Remove user from database
				await client.doubts.deleteMany({
					where: {
						user_id: userInfo.userId
					}
				});

				// Remove from room tracking
				if (userInfo.roomId) {
					rooms.get(userInfo.roomId)?.delete(socket);
					// Clean up empty rooms
					if (rooms.get(userInfo.roomId)?.size === 0) {
						rooms.delete(userInfo.roomId);
					}
				}

				// Clean up socket tracking
				socketUsers.delete(socket);
				
				console.log(`User ${userInfo.email} disconnected and cleaned up from database`);
			}
		} catch (error) {
			console.error("Error during socket cleanup:", error);
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