const peer_client_url = `${location.origin}/peer_client`;

//const peerConfiguration = { 'iceServers': [{ urls: "stun:stun.l.google.com:19302" }] }

const peerConfiguration = {
  iceServers: [
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
  ],
};

class P2PClient {
  static instance;
  static signalingChannel;
  static peerConnection;
  static dataChannels;

  host;
  id;
  username;

  constructor(gameId, username) {
    if (P2PClient.instance) console.warn("more than one instance of p2pClient");

    P2PClient.instance = this;
    P2PClient.dataChannels = {};
    this.id = undefined;
    this.host = gameId;
    this.username = username;
  }

  static get host() {
    return P2PClient.instance.host;
  }
  static get id() {
    return P2PClient.instance.id;
  }
  static get username() {
    return P2PClient.instance.username;
  }

  // overrideble game client stuff
  onClientConnection = () => {
    console.log("client DataChannel open");
  };
  onClientMessage = (event) => {
    console.log("client Received:", event.data);
  };

  sendMessageToHost = (dataChannelLabel, message) => {
    P2PClient.dataChannels[dataChannelLabel].send(JSON.stringify(typeof message == "object" ? message : { message }));
  };

  getUserDetails = () => {
    return { id: this.id, username: this.username };
  };

  redirectToGamePage = async () => {
    const htmlString = `<iframe id="p2pFrame" src="p2p/index.html" style="width: 100%;height: 100%;display: inline-block; border-width: 0;position: fixed;top: 0;left: 0;"> </iframe>`;
    // 1. Create a fragment and parse the HTML string
    const fragment = document.createRange().createContextualFragment(htmlString);
    // 2. Append it directly to your target element
    document.body.appendChild(fragment);
  };



  // call after setting up gameclient function handlers, starts the connection handshake
  start() {
    // request offer from server (GET) will pend until the offer is requested from the host and a valid/invalid response is returned.

    if (P2PClient.signalingChannel) {
      const message = "starting fresh signalingChannel";
      console.warn(message);
      P2PClient.signalingChannel.close();
    }

    console.log("start client ", peer_client_url);

    P2PClient.signalingChannel = new WebSocket(peer_client_url);

    P2PClient.signalingChannel.addEventListener("open", P2PClient.SendStartRequest);
    P2PClient.signalingChannel.addEventListener("message", P2PClient.HandleMessage);

    // allows us to wait till the start function is closed
    const { promise, resolve, reject } = Promise.withResolvers();

    P2PClient.signalingChannel.addEventListener("close", () => {
      try {
        // should close when the server is no longer needed or
        if (!P2PClient.peerConnection) return reject(new Error("initial communication failed, no peerConnection established"));

        switch (P2PClient.peerConnection.iceConnectionState) {
          case "connected":
          case "completed":
            resolve(P2PClient.instance);
            return;
          case "failed":
            reject(new Error("ICE failed to connect"));
            break;
          case "closed":
            reject(new Error("ICE connection closed"));
            break;
          default:
            reject(new Error("connection to server closed"));
        }
      } catch (e) {
        console.error(e);
      }
    });
    P2PClient.signalingChannel.addEventListener("error", (e) => {
      console.error(e);
      reject(e);
      //reject(new Error("connection encountered an error"));
    });

    // returns the promise so it can be used later.
    return promise;
  }

  static SendStartRequest() {
    console.log("client looking for game");
    P2PClient.signalingChannel.send(JSON.stringify({ request: "findGame", host: P2PClient.host }));
  }

  static HandleMessage(event) {
    const message = JSON.parse(event.data);
    console.log("client recieved message:", message);
    // message offer will have the name/id/hash of the client
    if (message.offer) P2PClient.AcceptOffer(message);
    else if (message.startIce) P2PClient.StartIceCollection(message);
    else if (message.candidate) P2PClient.HandleIceCandidate(message);
    else if (message.error) P2PClient.signalingChannel.dispatchEvent(new ErrorEvent("error", { error: new Error(event.data.error) }));
    else {
      console.warn(event.data);
    }
  }

  // returns the answer to the host's offer
  static async AcceptOffer(message) {
    try {
      P2PClient.instance.host = message.host;
      P2PClient.instance.id = message.id;

      P2PClient.peerConnection = new RTCPeerConnection(peerConfiguration);
      P2PClient.peerConnection.addEventListener("connectionstatechange", P2PClient.peerConnectionStateChanged);
      // assigns to the data channel
      P2PClient.peerConnection.addEventListener("datachannel", P2PClient.peerConnectionOnDataChannel);
      P2PClient.peerConnection.addEventListener("icecandidate", P2PClient.pushIce);

      console.log("accepting host's offer, assigning remoteDesc");
      // accepts an incomming message with an connection offer
      const remoteDesc = new RTCSessionDescription(message.offer);
      await P2PClient.peerConnection.setRemoteDescription(remoteDesc);
      console.log("creating answer for host");
      // creates an answer to the request and sends it back.
      const answer = await P2PClient.peerConnection.createAnswer();
      await P2PClient.peerConnection.setLocalDescription(answer);
      const localDescription = P2PClient.peerConnection.localDescription;

      const response = { answer: localDescription, id: message.id, host: message.host };
      console.log("sending response to server", response);
      console.groupCollapsed("ICE CONNECTION ATTEMPTS");
      P2PClient.signalingChannel.send(JSON.stringify(response));
    } catch (e) {
      console.error(e);
    }
  }

  static peerConnectionStateChanged(event) {
    switch (P2PClient.peerConnection.connectionState) {
      case "connected":
        console.groupEnd("ICE CONNECTION ATTEMPTS");
        console.log("connected to peer from client");
        break;
    }
  }

  static peerConnectionOnDataChannel(event) {
    const channel = event.channel;

    // add the channel to an object to call from them later
    P2PClient.dataChannels[channel.label] = channel;

    // sets up the unique data channels
    switch (channel.label) {
      case "game_socket":
        channel.onopen = (message) => P2PClient.instance.onClientConnection(message);
        channel.onmessage = (message) => P2PClient.instance.onClientMessage(message);
        break;
      case "http_proxy":
        channel.onopen = (event) =>
          init_http_proxy(channel)
            .then(() => P2PClient.instance.redirectToGamePage(event))
            .then(() => {
              console.log("sw connected to peer, redirecting to page");
              P2PClient.signalingChannel.close();
            });
        break;
    }
  }

  //
  static pushIce(event) {
    if (event.candidate && event.candidate.candidate) {
      console.log("CLIENT ICE candidate:", event.candidate);
      P2PClient.signalingChannel.send(JSON.stringify({ candidate: event.candidate, id: P2PClient.id, host: P2PClient.host }));
    }
  }

  static HandleIceCandidate(message) {
    try {
      const ice = {
        candidate: message.candidate,
        sdpMid: message.sdpMid ?? null,
        sdpMLineIndex: message.sdpMLineIndex ?? 0,
      };
      //console.log("Adding ICE:", ice);
      P2PClient.peerConnection.addIceCandidate(ice);
    } catch (e) {
      console.error(e);
    }
  }
}

// connects the service worker to allow fetch requests to */p2p/* to use the connection to the host to fetch files
async function init_http_proxy(channel) {
  try {
    console.groupCollapsed("connecting to http_proxy");
    console.log("channel http_proxy is open");
    window.http_proxy = channel;

    let str = location.pathname;
    let path = `${str.slice(0, str.lastIndexOf("/"))}/sw.js`;
    console.log("registering service worker", path);

    await navigator.serviceWorker.register(path);
    console.log("service worker registered");

    await new Promise((resolve) => {
      try {
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
        navigator.serviceWorker.ready.then((reg) => {
          reg.active.postMessage(
            {
              type: "setPort",
              port: msgChannel.port2,
            },
            [msgChannel.port2],
          );
        });
      } catch (e) {
        console.groupEnd();
        console.error(e);
      }
    });
  } catch (e) {
    console.groupEnd();
    console.error(e);
  } finally {
    console.groupEnd();
  }
}

// client for the game (browser)
function startClient(gameId, username) {
  try {
    window.P2PClient = P2PClient;

    const client = new P2PClient(gameId, username);
    return client.start();
  } catch (e) {
    console.error(e);
  }
}

// for calling manually
function redirectToGamePage() {
  P2PClient.instance.redirectToGamePage();
}
