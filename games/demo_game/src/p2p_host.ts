// server url to use as peering service. 
// needed for nodejs stuff NOT NEEDED IN WEB
import fs from 'node:fs';
import { url } from 'node:inspector';
import path from 'node:path';
import WebSocket from "ws";
const { RTCPeerConnection, RTCSessionDescription, WebRtcHttpBridge } = require('@koush/wrtc');



type iceServers = { urls: string | string[], username?: string, credential?: string }

const peerConfiguration = {
    iceServers: [
        {
            // Primary standard Google STUN server
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            // Alternative fallback Google STUN configurations
            urls: [
                'stun:stun1.l.google.com:3478',
                'stun:stun2.l.google.com:19302'
            ]
        },
    ]
} satisfies { iceServers: iceServers[] }






// creates a configuration for the connection 
export class P2PHost {

    static connected_clients: { [key: string]: RTCPeerConnection } = {};
    static signalingChannel: WebSocket; // websocket channel for setup/ comunication with the server


    static dataChannels: { [key: string]: (socket: RTCDataChannel) => void } = {};

    constructor() {
        // ADD NEW DATA CHANNELS LIKE THIS
        P2PHost.dataChannels["game_socket"] = dc => {
            dc.onopen = () => console.log("P2Phost game_socket open");;
            dc.onmessage = (event) => console.log("P2PHost game_socket Received:", event.data);
        }
        P2PHost.dataChannels["http_proxy"] = httpProxyDataChannel;
    }

    async start(url: string) {
        // if a current websocket is open and connected. skip this 
        if (P2PHost.signalingChannel && P2PHost.signalingChannel.readyState == WebSocket.OPEN) {
            console.warn("host websocket already setup and active");
            return;
        }

        console.log("setting up host websocket", url);
        // opens the weboscket connection to the server
        P2PHost.signalingChannel = new WebSocket(url, {
            /*!!!!! this is an insecure channel */
            rejectUnauthorized: false
        });

        // wait for messages to the websocket from the server to handle the incoming request for clients.  
        P2PHost.signalingChannel.addEventListener('message', async (event: any) => {
            const message = JSON.parse(event.data);
            // message offer will have the name/id/hash of the client
            if (message.request)
                returnOfferToClient(message);
            else if (message.answer)
                finaliseClientConnection(message);
            else
                console.warn(event.data);
        });
        // Handle connection open
        P2PHost.signalingChannel.addEventListener('open', () => {
            console.log('p2p host websocket open and active');
        });
        // Handle connection closure
        P2PHost.signalingChannel.addEventListener('close', () => {
            console.log('p2p host websocket disconnected, app is closing');
            // exits the program since we are no longer connected to the main server
            process.exit(0);
        });
        // Handle errors
        P2PHost.signalingChannel.addEventListener('error', (error: any) => {
            console.error('p2p host websocket error:', error);

            if (P2PHost.signalingChannel.readyState > 1)
                console.log("websocket failed to connect and is closing/closed");
        });
    }
}



async function returnOfferToClient(message: any) {
    console.log("sending offer to new client", message.id);
    // creates a new connection to the client

    const peerConnection = new RTCPeerConnection(peerConfiguration);

    // adds the new connection to the list. 
    P2PHost.connected_clients[message.id] = peerConnection;

    // adds the peer to peer data channel streams to the connection
    Object.entries(P2PHost.dataChannels).forEach(([key, handler]) => { handler(peerConnection.createDataChannel(key)); });

    // creates an offer with the data given
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    //then send the offer to the main server
    P2PHost.signalingChannel.send(JSON.stringify({ 'offer': offer, "host": message.host, "id": message.id }));
}

async function finaliseClientConnection(message: any) {
    console.log("finalising client", message.id);
    // assume we get the id/hash from the server. 
    const peerConnection = P2PHost.connected_clients[message.id];
    // if valid connection then it will pass these
    const remoteDesc = new RTCSessionDescription(message.answer);
    await peerConnection.setRemoteDescription(remoteDesc);

    // add the ice candidates
    for (const c of message.candidates) {
        if (!c.candidate)
            continue;
        // makes sure its formatted correctly
        const ice = {
            candidate: c.candidate,
            sdpMid: c.sdpMid ?? null,
            sdpMLineIndex: c.sdpMLineIndex ?? 0
        };
        //console.log("Adding ICE:", ice);
        peerConnection.addIceCandidate(ice).catch((err) => {
            console.error("Failed to add ICE candidate:", err, ice);

        });
    }
}


// data channel to handle the sw's forward http requests. 
const httpProxyDataChannel = (dc: RTCDataChannel) => {
    if (typeof location !== 'undefined') {
        // dont add this if on the web to avoid errors with node:fs and node:path
        return;
    }

    dc.onopen = () => { console.log("http_proxy open") };
    dc.onmessage = async (msg) => {

        if (!msg.data) {
            console.assert("http-proxy no data sent");
            return;
        } else {
            console.log("http-proxy handling message");
        }
        // assumes data is in json format
        const req = JSON.parse(msg.data);
        console.log(req);
        const filePath = path.join(__dirname, "../public", req.path ?? "NO_PATH_PROVIDED");

        try {
            // fetchs the file and returns it
            const data = await fs.promises.readFile(filePath);
            dc.send(JSON.stringify({
                ok: true,
                id: req.id,
                mime: getMime(filePath),
                body: data.toString("base64")
            }));
            console.log("sent file to client", filePath);
        } catch (e) {
            // if it cant find the file or throws an error sends the appropriate response
            dc.send(JSON.stringify({ ok: false, id: req.id, error: "Not found" }));
            console.log("failed to send to client", filePath);
            console.log("had an error", req.id);
        }
    };
};

// makes sure the file types are interpreted correctly 
function getMime(file: string) {
    if (file.endsWith(".html")) return "text/html";
    if (file.endsWith(".js")) return "application/javascript";
    if (file.endsWith(".css")) return "text/css";
    if (file.endsWith(".png")) return "image/png";
    if (file.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
}



// connects to localhost or if hosting from the web uses the urls host name and port
const locationHost = typeof location !== 'undefined' ? location.host : "localhost:8000";
const peer_host_wss_url = `wss://${locationHost}/peer_server`;
export function startHost() {
    const host = new P2PHost().start(peer_host_wss_url);
}

