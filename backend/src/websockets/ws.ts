import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket) => {
	console.log("connection established")
	// server gets msg from client
	socket.on("message", async (msg) => {
		try {
			// parse it into JSON because we get Buffer object by default 
			const parsedMsg = JSON.parse(msg.toString());
			
			// user is requesting to join a room
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

				const user = await client.users.findUnique({
					where: { email: parsedMsg.payload.email }
				});
				if(!user) return;
				await client.doubts.create({
					data: {
						user_id: user.id,
						room: parsedMsg.payload.roomId,
						doubt: ""
					}
				});
			}

			if(parsedMsg.type == "create"){
				// just create a room in with this user in the doubts table
				// this makes sure a user can "join" a room only if it has been "created" by someone  
				const user = await client.users.findUnique({
					where: {
						email: parsedMsg.payload.email
					}
				})
				if(!user) return;
				await client.doubts.create({
					data: {
						user_id: user.id,
						room: parsedMsg.payload.roomId,
						doubt: ""
					}
				})
			}

			// user is requesting to chat
			if(parsedMsg.type == "ask-doubt"){

			}

			// user is requesting to leave the room
			if(parsedMsg.type == "leave"){

			}

		} catch (error: any) {
            socket.send(JSON.stringify({
                type: "error",
                payload: { message: error.message || "Invalid message format" }
            }));
        }
	})

	// close the connection 
	socket.on("close", () => {

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
//         "msg": "hi there"
//     }
// }

// {
//     "type": "create",
//     "payload": {
//         "email": "abc@gmail.com",
//			"roomId" "123"
//     }
// }