import "dotenv/config";
import cors from "cors";
import express from "express";
import { resolve } from "path";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { ExpressPeerServer } from "peer";

const app = express();
const server = createServer(app);
const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
    proxied: true,
    debug: true,
    path: "/peer",
    ssl: {},
});

// express shenanigans
app.use(cors());
app.use(peerServer)

app.use("/", express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(resolve("./public/index.html"));
});


server.listen(3000, () => {
    console.log("server running at http://localhost:3000");
});

// socket.io shenanigans

let userQueue = []; // queue for users waiting to be paired
let chatRooms = {}; // object to store chat rooms

io.on("connection", (socket) => {
    // queue and pair logic

    socket.on("joinQueue", (msg) => {
        userQueue.push(socket); // add user to queue
        socket.emit('joinQueue', 'ok')

        if (userQueue.length > 1) {
            const user1 = userQueue.shift();
            const user2 = userQueue.shift();
    
            establishSession(user1, user2);
        } else console.log(`${userQueue.length} client in the queue`);
    })

    // handle chat messages per room
    socket.on("chat message", (msg) => {
        const room = getRoomBySocket(socket.id);
        if (!room) return;
        // console.log("message in room: ", room)
        io.to(room).emit("chat message", msg); // broadcast message to room
    });

    // Establish WebRTC signaling
    socket.on("join-room", (offer) => {
        console.log("join-room offer received:" + offer);
        const room = getRoomBySocket(socket.id);
        if (!room) {
            console.log(`User ${socket.id} not found in any room`);
            return;
        }
        io.to(room).emit("join-room", offer); // Send offer to the other peer
    });

    // handle disconnect logic
    socket.on("disconnect", () => {
        console.log(`${socket.id} disconnected`);

        // Check if the user is in the queue
        const index = userQueue.indexOf(socket);
        if (index !== -1) {
            userQueue.splice(index, 1); // Remove from queue if present
            return;
        }

        const room = getRoomBySocket(socket.id);
        if (room && chatRooms[room]) {
            const [user1, user2] = chatRooms[room].clients; // Destructure clients

            // Notify the other user and remove them from the room
            const otherUser = socket === user1 ? user2 : user1;
            if (otherUser) {
                otherUser.emit("system", "disconnected");
                otherUser.leave(room);
            }

            // Clean up the room
            delete chatRooms[room];
            console.log(`Chat room ${room} closed`);
        }
    });
});

// chatroom shenanigans
function establishSession(client1, client2) {
    // generate unique chatroom name based on client id's
    let roomName = client1.id + "#-#" + client2.id;

    client1.join(roomName);
    client2.join(roomName);

    chatRooms[roomName] = {
        clients: [client1, client2],
        messages: [],
    };

    client1.emit("startConn");
    
    io.to(roomName).emit("system", "connected")
}

function getRoomBySocket(socketId) {
    for (const room in chatRooms) {
        const clients = chatRooms[room].clients;
        // console.log("clients:", clients); // Log to check the structure

        // Check if the socketId matches either client1 or client2
        if (clients[0].id === socketId || clients[1].id === socketId) {
            return room;
        }
    }
    return null;
}
