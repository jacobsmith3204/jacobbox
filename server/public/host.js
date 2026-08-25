// server url to use as peering service/ verify if host exists else use localhost
const locationHost = typeof location !== 'undefined' ? location.host : "localhost:8000";
const peer_host_wss_url = `wss://${locationHost}/peer_server`;
// creates a configuration for the connection 


class Host {
    static configuration = { 'iceServers': [{ urls: "stun:stun.l.google.com:19302" }] }
    static connected_clients = {};
    static signalingChannel; // websocket channel for setup/ comunication with the server


    static dataChannels = {}; //["key", (channel_object)=> {}]

    constructor() {
        // ADD NEW DATA CHANNELS HERE LIKE THIS
        const host = this;
        Host.dataChannels["game_socket"] = (game_socket) => {
            game_socket.onopen = host.OnHostConnection;
            game_socket.onmessage = host.OnHostMessage;
        }
    }

    async start(url) {
        // if a current websocket is open and connected. skip this 
        if (Host.signalingChannel && Host.signalingChannel.readyState == WebSocket.OPEN) {
            console.warn("host websocket already setup and active");
            return;
        }
        else console.log("setting up host websocket", url ?? peer_host_wss_url);

        // opens the weboscket connection to the server

        Host.signalingChannel = new WebSocket(url ?? peer_host_wss_url);

        // wait for messages to the websocket from the server to handle the incoming request for clients.  
        Host.signalingChannel.addEventListener('message', async event => {
            const message = JSON.parse(event.data);
            // message offer will have the name/id/hash of the client
            if (message.request)
                Host.returnOfferToClient(message);
            else if (message.answer)
                Host.finaliseClientConnection(message);
        });
    }


    static async returnOfferToClient(message) {
        console.log("sending offer to new client", message.id);
        // creates a new connection to the client
        const peerConnection = new RTCPeerConnection(Host.configuration);
        // adds the new connection to the list. 
        Host.connected_clients[message.id] = peerConnection;

        // adds the peer to peer websocket data stream channel to the connection
        Object.entries(Host.dataChannels).forEach(([key, handler]) => { handler(peerConnection.createDataChannel(key)); });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        //then send the offer to the main server
        Host.signalingChannel.send(JSON.stringify({ 'offer': offer, "host": message.host, "id": message.id }));
    }


    static async finaliseClientConnection(message) {
        console.log("finalising client", message.id);
        // assume we get the id/hash from the server. 
        const peerConnection = Host.connected_clients[message.id];
        // if valid connection then it will pass these
        const remoteDesc = new RTCSessionDescription(message.answer);
        await peerConnection.setRemoteDescription(remoteDesc);

        // add the candidates
        for (const c of message.candidates) {
            if (!c.candidate)
                continue;
            const ice = {
                candidate: c.candidate,
                sdpMid: c.sdpMid ?? null,
                sdpMLineIndex: c.sdpMLineIndex ?? 0
            };
            //console.log("Adding ICE:", ice);
            peerConnection.addIceCandidate(ice);
        }

        // Listen for connectionstatechange on the local RTCPeerConnection
        // when its connected, create a websocket datachannel to send events over. 
        peerConnection.addEventListener('connectionstatechange', event => {
            switch (peerConnection.connectionState) {
                case 'connected':
                    console.log("connected to peer from host");
                    break;
            }
        });
    }

    OnHostConnection() {
        console.log("host DataChannel open");
    }
    OnHostMessage(event) {
        console.log("host Received:", event.data);
    }

}









function startHost() {
    const host = new Host().start(peer_host_wss_url);
}