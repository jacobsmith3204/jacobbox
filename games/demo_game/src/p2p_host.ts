// server url to use as peering service.
// needed for nodejs stuff NOT NEEDED IN WEB
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
const { RTCPeerConnection, RTCSessionDescription, WebRtcHttpBridge } = require("@koush/wrtc");

type iceServers = { urls: string | string[]; username?: string; credential?: string };


// could be loaded in via .env file
const peerConfiguration = {
  iceServers: [
    {
      // Primary standard Google STUN server
      urls: "stun:stun.l.google.com:19302",
    },
    {
      // Alternative fallback Google STUN configurations
      urls: ["stun:stun1.l.google.com:3478", "stun:stun2.l.google.com:19302"],
    },
  ],
} satisfies { iceServers: iceServers[] };

// INTERFACE TO HANDLE THE P2P CONNECTION PROCESS
// FIRST REQUIRING A CONNECTION TO A PUBLIC SERVER TO ALLOW THE RTC CONNECTION HANDSHAKE PROCESS
export class P2PHost {
  //
  static connected_clients: { [key: string]: RTCPeerConnection } = {};
  static signalingChannel: WebSocket; // websocket channel for setup/ comunication with the server
  static iceMap: Map<any, any[]> = new Map<any, any[]>();

  static dataChannels: { [key: string]: (socket: RTCDataChannel) => void } = {};

  constructor() {
    // ADD NEW DATA CHANNELS LIKE THIS
    P2PHost.dataChannels["game_socket"] = (dc) => {
      dc.onopen = () => console.log("P2Phost game_socket open");
      dc.onmessage = (event) => {
        console.warn("unimplemented channel[game_socket] recived, will pong the same data:", event.data);
        dc.send(event.data);
      }
    };
    P2PHost.dataChannels["http_proxy"] = httpProxyDataChannel;
  }

  async start(url: string) {
    // if a current websocket is open and connected. skip this
    if (P2PHost.signalingChannel && P2PHost.signalingChannel.readyState == WebSocket.OPEN) {
      console.warn("host websocket already setup and active");
      return;
    }

    console.log("setting up host websocket", url);
    const wsOptions = {
      /*!!!!! this is an insecure channel */
      rejectUnauthorized: false
    };
    // opens the weboscket connection to the server
    P2PHost.signalingChannel = new WebSocket(url, wsOptions);

    if(wsOptions.rejectUnauthorized) console.warn("using an insecure websocket channel");

    // lets us know we are connected
    P2PHost.signalingChannel.addEventListener("open", () =>  console.log("p2p host websocket open and active"));
    // wait for messages to the websocket from the server to handle the incoming request for clients.
    P2PHost.signalingChannel.addEventListener("message", P2PHost.HandleMessage);
    // exits the program since we are no longer connected to the main server
    P2PHost.signalingChannel.addEventListener("close", () => {
      console.log("p2p host websocket disconnected, app is closing");
      process.exit(0);
    });
    // Handle errors
    P2PHost.signalingChannel.addEventListener("error", (error) => console.error("p2p host websocket error:", error));
  }

  // HANDLES INCOMMING TRAPHIC FROM THE SIGNALING SERVER
  // this calls the other functions based on the data in the message/request
  static HandleMessage(event: any) {
    const message = JSON.parse(event.data);
    //console.log("host recieved message:", message);
    // message offer will have the name/id/hash of the client
    if (message.request) P2PHost.ReturnConnectionOffer(message);
    else if (message.answer) P2PHost.AcceptAnswer(message);
    else if (message.candidate) P2PHost.HandleIceCandidate(message);
    else console.warn(event.data);
  }

  // Create an initial offer to connect
  static async ReturnConnectionOffer(message: any) {
    try {
      console.log("sending offer to new client", message.id);

      // creates a new connection to the p2p client
      const peerConnection = new RTCPeerConnection(peerConfiguration);

      // adds the new connection to the list for future referance
      P2PHost.connected_clients[message.id] = peerConnection;

      // adds the peer to peer data channel streams to the connection
      // the main ones are added in the constructor, but you can also add them before calling init
      Object.entries(P2PHost.dataChannels).forEach(([key, handler]) => {
        handler(peerConnection.createDataChannel(key));
      });

      // initialises a fallback buffer for the ice we might recieve while waiting for the remoteDescription to be initialised.
      P2PHost.iceMap.set(message.id, []);

      // creates an offer for the client
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      //send the offer to the main server
      P2PHost.signalingChannel.send(JSON.stringify({ offer: offer, host: message.host, id: message.id }));
    } catch (e) {
      console.error(e);
    }
  }

  // accepts the response
  static async AcceptAnswer(message: any) {
    console.log("finalising client", message.id);
    // assume we get the id/hash from the server.
    const peerConnection = P2PHost.connected_clients[message.id];
    // if valid connection then it will pass these
    const remoteDesc = new RTCSessionDescription(message.answer);
    await peerConnection.setRemoteDescription(remoteDesc);

    peerConnection.addEventListener("icecandidate", (event) => P2PHost.PushIce(event, { id: message.id, host: message.host }));

    // adds all the buffered ice that got queued up
    for (const ice of P2PHost.iceMap.get(message.id) || [])
      peerConnection.addIceCandidate(ice).catch((e) => console.error(e));
    // deletes the queue
    P2PHost.iceMap.delete(message.id);
  }

  static PushIce(event: any, data: any) {
    // makes the object we are trying to send is valid
    if (event.candidate && event.candidate.candidate) {
      console.log("HOST ICE candidate:", event.candidate);
      // adds the candidate data along side {id,host,candidate}
      data["candidate"] = event.candidate;
      // sends it to the server
      P2PHost.signalingChannel.send(JSON.stringify(data));
    }
  }
  // handles ice trickle
  static async HandleIceCandidate(message: any) {
    console.log(message);
    // fetch the correct p2p client
    const peerConnection = P2PHost.connected_clients[message.id];

    // format the ice object correctly
    const candidate = message.candidate;
    const ice = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
      usernameFragment: candidate.usernameFragment || undefined
    };
    // add the ice to the object if its avalible, othewise adds it to the queued buffer.
    if (peerConnection) peerConnection.addIceCandidate(ice).catch((e) => { console.error(e) });
    else P2PHost.iceMap.get(peerConnection)?.push(ice);
  }
}

// data channel to handle the sw's forward http requests.
// added as one of the main data channels in the p2pClient's constructor()
// this allows it to interact with node.fs to fetch files from .src/[this_file] -> ../public folder.
//
const httpProxyDataChannel = (dc: RTCDataChannel) => {
  if (typeof location !== "undefined") {
    // dont add this if on the web to avoid errors with node:fs and node:path
    return;
  }

  dc.onopen = () => {
    console.log("http_proxy open");
  };
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
      dc.send(
        JSON.stringify({
          ok: true,
          id: req.id,
          mime: getMime(filePath),
          body: data.toString("base64"),
        }),
      );
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
const locationHost = typeof location !== "undefined" ? location.host : "localhost:8000";
const peer_host_wss_url = `wss://${locationHost}/peer_server`;
export function startHost() {
  const host = new P2PHost().start(peer_host_wss_url);
}
