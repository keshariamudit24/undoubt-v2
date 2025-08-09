import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket) => {
	console.log("connection established")
	// server gets msg from client
	socket.on("message", (msg) => {
		console.log("got some msg")
		// send msg from server to client 
		if(msg.toString() == "hello"){
			socket.send("hi there");
		}
	})
})
