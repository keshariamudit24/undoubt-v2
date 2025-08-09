"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
wss.on("connection", (socket) => {
    console.log("connection established");
    // server gets msg from client
    socket.on("message", (msg) => {
        console.log("got some msg");
        // send msg from server to client 
        if (msg.toString() == "hello") {
            socket.send("hi there");
        }
    });
});
//# sourceMappingURL=ws.js.map