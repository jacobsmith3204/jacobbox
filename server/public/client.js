const peer_client_url = `${location.origin}/peer_client`;





class Client {
    static configuration = {
        iceServers: [
            {
                urls: "stun:stun.relay.metered.ca:80",
            },
            {
                urls: "turn:global.relay.metered.ca:80",
                username: "cdae4cba9d10986d8368192c",
                credential: "0E4wUEGm3H1XgUUG",
            },
            {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "cdae4cba9d10986d8368192c",
                credential: "0E4wUEGm3H1XgUUG",
            },
            {
                urls: "turn:global.relay.metered.ca:443",
                username: "cdae4cba9d10986d8368192c",
                credential: "0E4wUEGm3H1XgUUG",
            },
            {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "cdae4cba9d10986d8368192c",
                credential: "0E4wUEGm3H1XgUUG",
            },
        ],

    }

    async start(host) {
        console.log("startClient");

        host ??= location.hash.length == 5 ? location.hash.slice(1) : "1234";


        // request offer from server (GET) will pend until the offer is requested from the host and a valid/invalid response is returned.  
        const message = await this.fetchConnectionOfferFromRoomHost(host);
        console.log("finished waiting for offer");
        // early exit if it doesnt get back the expected offer
        if (!message.offer) {
            console.error("no offer in response message", message);
            return;
        }


        // creates a peer conection. 
        const peerConnection = new RTCPeerConnection(Client.configuration);

        // assigns to the data channel 
        peerConnection.ondatachannel = event => {
            const channel = event.channel;
            switch (channel.label) {
                case "game_socket":

                    channel.onopen = () => { window.game_socket = channel; OnClientConnection() };
                    channel.onmessage = OnClientMessage;
                    break;

                case "http_proxy":
                    channel.onopen = () => {
                        console.log("channel http_proxy is open");
                        window.http_proxy = channel;

                        let str = location.pathname;
                        let path = `${str.slice(0, str.lastIndexOf('/'))}/sw.js`;
                        console.log("registering service worker", path);

                        navigator.serviceWorker.register(path).then(() => {
                            console.log("service worker registered")

                            // Create a MessageChannel to bridge SW <-> DataChannel
                            const msgChannel = new MessageChannel();

                            // DataChannel → SW
                            channel.onmessage = (ev) => msgChannel.port1.postMessage(ev.data);

                            // SW → DataChannel
                            msgChannel.port1.onmessage = (ev) => channel.send(ev.data);

                            // Wait for SW to be active
                            navigator.serviceWorker.ready.then(reg => {

                                console.log("sending port to service worker");

                                reg.active.postMessage(
                                    {
                                        type: "setPort",
                                        port: msgChannel.port2
                                    },
                                    [msgChannel.port2]
                                );
                            });
                        });
                    };
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
        this.sendAnswerToHost({ 'answer': peerConnection.localDescription, candidates, "id": message.id, "host": message.host });


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
    async sendAnswerToHost(message) {
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



async function redirectToGamePage() {

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

function executeScripts(doc) {
    const base = doc.querySelector("base")?.href || document.baseURI;
    const scripts = doc.querySelectorAll("script");

    scripts.forEach(oldScript => {
        const newScript = document.createElement("script");

        // Copy attributes except src
        for (const attr of oldScript.attributes) {
            if (attr.name !== "src") {
                newScript.setAttribute(attr.name, attr.value);
            }
        }

        // Resolve src manually
        if (oldScript.src) {
            const resolved = new URL(oldScript.getAttribute("src"), base).href;
            newScript.src = resolved;
        } else {
            newScript.textContent = oldScript.textContent;
        }

        oldScript.replaceWith(newScript);
    });
}


// client for the game (browser)
async function startClient(host) {
    const client = window.client = new Client();
    client.start();
}



function OnClientConnection() {
    console.log("client DataChannel open");
}
function OnClientMessage(event) {
    console.log("client Received:", event.data);
}