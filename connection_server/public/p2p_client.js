const peer_client_url = `${location.origin}/peer_client`;

//const peerConfiguration = { 'iceServers': [{ urls: "stun:stun.l.google.com:19302" }] }

const peerConfiguration = {'iceServers': [
     {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:oceania.relay.metered.ca:80",
      username: "cdae4cba9d10986d8368192c",
      credential: "0E4wUEGm3H1XgUUG",
    },
    {
      urls: "turn:oceania.relay.metered.ca:80?transport=tcp",
      username: "cdae4cba9d10986d8368192c",
      credential: "0E4wUEGm3H1XgUUG",
    },
    {
      urls: "turn:oceania.relay.metered.ca:443",
      username: "cdae4cba9d10986d8368192c",
      credential: "0E4wUEGm3H1XgUUG",
    },
    {
      urls: "turns:oceania.relay.metered.ca:443?transport=tcp",
      username: "cdae4cba9d10986d8368192c",
      credential: "0E4wUEGm3H1XgUUG",
    },
]};
// turn:oceania.relay.metered.ca:80



class Client {
    

    // overrideble game client stuff
    OnClientConnection = () => {
        console.log("client DataChannel open");
    }
    OnClientMessage = (event) => {
        console.log("client Received:", event.data);
    }

    redirectToGamePage = async () => {
        const htmlString = `<iframe id="p2pFrame" src="p2p/index.html" style="
    width: 100%;
    height: 100%;
    display: inline-block;
    border-width: 0;
    position: fixed;
    top: 0;
    left: 0; 
    "> </iframe>`;
        // 1. Create a fragment and parse the HTML string
        const fragment = document.createRange().createContextualFragment(htmlString);
        // 2. Append it directly to your target element
        document.body.appendChild(fragment);
    }



    // call after setting up gameclient function handlers, starts the connection handshake 
    async start(gameId) {
        console.log("startClient");

        // request offer from server (GET) will pend until the offer is requested from the host and a valid/invalid response is returned.  
        const message = await this.fetchConnectionOfferFromRoomHost(gameId);
        console.log("finished waiting for offer");
        // early exit if it doesnt get back the expected offer
        if (!message.offer) {
            throw new Error(`no offer in response message ${message}`);
        }


        // creates a peer conection. 
        const peerConnection = new RTCPeerConnection(peerConfiguration);

        // assigns to the data channel 
        const thisClient = this;
        peerConnection.ondatachannel = event => {
            const channel = event.channel;
            switch (channel.label) {
                case "game_socket":
                    channel.onopen = () => { window.game_socket = channel; thisClient.OnClientConnection() };
                    channel.onmessage = () => thisClient.OnClientMessage();
                    break;
                case "http_proxy":
                    channel.onopen = () => init_http_proxy(channel).then(() => thisClient.redirectToGamePage());
                    break;
            }
        }
        // collect ice canadates between the client and the host (uses the offer)
        const candidates = [];
        peerConnection.addEventListener('icecandidate', event => { if (event.candidate) candidates.push(event.candidate); });

        console.log("set up peer connection, assigning remote and local description");

        // accepts an incomming message with an connection offer
        const remoteDesc = new RTCSessionDescription(message.offer);
        await peerConnection.setRemoteDescription(remoteDesc);
        // creates an answer to the request and sends it back.
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        console.log("waiting for ice to gather");
        await this.IceGatheringCompleted(peerConnection);

        console.log("sending answer back to host");
        this.postAnswerToHost({ 'answer': peerConnection.localDescription, candidates, "id": message.id, "host": message.host });


        // Listen for connectionstatechange on the local RTCPeerConnection
        // when its connected, create a websocket datachannel to send events over. 
        peerConnection.addEventListener('connectionstatechange', event => {
            switch (peerConnection.connectionState) {
                case 'connected':
                    console.log("connected to peer from client");
                    break;
            }
        });
    }

    // fetch requests a game 
    async fetchConnectionOfferFromRoomHost(host) {
        const req = await fetch(peer_client_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 'request': "findGame", host })
        });
        //  { id: [id for this client],  host: [host/game_code], offer: [rtcPeerConnection offer] } 
        return req.json();
    }
    // post to send the offer's answer 
    async postAnswerToHost(message) {
        // send the response back to the server 
        return fetch(peer_client_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });
    }

    async IceGatheringCompleted(peerConnection) {
        // makes sure we have completed the ice gathering stage. 
        return new Promise(resolve => {
            if (peerConnection.iceGatheringState === "complete")
                resolve();
            else
                peerConnection.addEventListener("icegatheringstatechange", () => (peerConnection.iceGatheringState === "complete") ? resolve() : null);
        });
    }
}


// connects the service worker to allow fetch requests to */p2p/* to use the connection to the host to fetch files 
async function init_http_proxy(channel) {
    console.log("channel http_proxy is open");
    window.http_proxy = channel;

    let str = location.pathname;
    let path = `${str.slice(0, str.lastIndexOf('/'))}/sw.js`;
    console.log("registering service worker", path);

    await navigator.serviceWorker.register(path);
    console.log("service worker registered");

    await new Promise(resolve => {
        // Create a MessageChannel to bridge SW <-> DataChannel
        const msgChannel = new MessageChannel();
        // DataChannel → SW
        channel.onmessage = (ev) => msgChannel.port1.postMessage(ev.data);
        // SW → DataChannel
        msgChannel.port1.onmessage = (ev) => {
            // Resolve promise on first message from the service worker when it initialises. 
            resolve(ev.data);

            channel.send(ev.data); // sends data via the channel
        };
        // Wait for SW to be active, (then sends a message to connect the port?)
        navigator.serviceWorker.ready.then(reg => {
            reg.active.postMessage(
                {
                    type: "setPort",
                    port: msgChannel.port2
                },
                [msgChannel.port2]
            );
        });
    });
    console.log("sw connected to peer, redirecting to page");
}



// client for the game (browser)
async function startClient(gameId) {
    const client = window.client = new Client();
    return client.start(gameId);
}

