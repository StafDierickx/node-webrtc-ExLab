// import { Socket } from "socket.io";
// import {Peer} from "https://esm.sh/peerjs@1.5.4?bundle-deps"

console.log("client side loaded");

const socket = io();

const form = document.getElementById("chatbox");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const statusEl = document.getElementById("status");

let lastMessage // used for filtering last message

let conId;
let conn;
let peer = new Peer({
    // host: "localhost",
    debug: 1,
    // path:"/peer"
});
window.peer = peer;

// system
socket.on("system", (msg) => {
    console.log(`System: ${msg}`);

    if (msg === "connected") {
        statusEl.textContent = "Connected to server";
    } else if (msg == "disconnected") {
        statusEl.textContent = "Disconnected, rejoining queue...";
        socket.emit("joinQueue");
    }
    // TODO: read disconnect session and show btn to reenter the queue
});

// chat message shenanigans
form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    if (!input.value) return;
    lastMessage = input.value
    console.log("sending message: ", input.value);

    if (!socket.emit("chat message", input.value)) return;
    write2chat(input.value, true);
    input.value = "";
});

function sendMessage() {
    if (!conn) return;
    const msg = { message: input.value };

    conn.send(msg); // send to peer if connected
    write2chat(input.value, true);
    input.value = "";
}

function write2chat(message, isMe) {
    const li = document.createElement("li");
    li.textContent = `You: ${input.value}`;
    messages.appendChild(li);
}

// receive messages from server and add to chat history
socket.on("chat message", (msg) => {
    if (msg == lastMessage) return; // filter out last message (duplicate)
    console.log("received message: ", msg);

    const li = document.createElement("li");
    li.textContent = `${msg}`;
    messages.appendChild(li);

    // messages.insertAdjacentHTML("beforeend", msg);
    
});

socket.on('joinQueue', (data) => {
    console.log('joined queue')
    statusEl.textContent = 'Joined Queue';
});

// audio/video shenanigans
socket.on("startConn", async () => {
    console.log("Starting connection...");
    getLocalStream();
});

peer.on("open", (id) => {
    if (!conId) {
        conId = id;
        console.log("My peer ID is: " + conId);
        document.getElementById("peerId").innerText = "Peer id: " + conId;

        socket.emit("joinQueue"); // join queue if not already joined
    }
    conn = connection;
    conn.on("open", () => {
        console.log("Connection opened with peer:", conn.peer);
    });
    conn.on("data", (data) => {
        console.log(`Received data: ${data}`);
    });
});

peer.on("connection", (connection) => {
    conn = connection;
    console.log("Received connection from peer:", connection.peer);

    conn.on("data", (data) => {
        console.log(`Received data: ${data}`);
        // Optionally, send a message back
        conn.send("Hello from the client2!");
    });
});

peer.on("call", (call) => {
    console.log("Received call from peer:", call.peer);
    // call.answer(window.localStream);
    call.answer(window.localStream);
});

peer.on("close", () => {
    console.log("Connection with peer closed.");

    // TODO: not just reload page to re enter the queue
    // TODO: this doesn't even work
    window.location.reload();
});

let localStream;
function getLocalStream() {
    navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
            window.localStream = stream;
            // window.localAudio.srcObject = stream;
            // window.localAudio.autoplay = true;
            document.getElementById('localVideo').srcObject = stream
        })
        .catch((err) => {
            console.error(`you got an error: ${err}`);
        });
}
getLocalStream();

socket.on("startConn", async () => {
    console.log("Starting connection...");

    if (conId) {
        socket.emit("join-room", conId);
    } else console.error("startConn request received before peer id was set");

    if (!localStream) {
        getLocalStream();
    }
});

socket.on("join-room", async (offer) => {
    if (offer === conId) {
        console.log("Received offer for the same connection id, ignoring...");
        return;
    }

    console.log("Received offer:", offer);

    if (!localStream) {
        await getLocalStream();
    }

    console.log("Connecting to peer");
    conn = peer.call(offer, window.localStream);

    // will launch when successfully connected
    conn.on("open", function () {
        console.log("Connection opened with peer:", conn.peer);
        // Send a message

        // conn.send("Hello!");
    });

    conn.on("data", (data) => {
        console.log("Received data:", data);
    });
});

peer.on("error", (err) => console.error(err));