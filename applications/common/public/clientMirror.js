console.log(`%c STARTING IFRAME INITIALISATION`, "color: lightgreen; font-weight: bold");


class ClientMirror {
  static messageId = 0;
  static pendingRequests = new Map();

  constructor() {
    // Listen for the parent's response
    const client = this; 
    window.addEventListener("message", client.messageCallback.bind(client));
    console.log("sending INIT message to parent");
    window.parent.postMessage({ type: "INIT" }, "*");
  }

  async requestToJoinGame() {
    // fetched id and username to send to host
    const message = await this.sendToParent("getUserDetails");
    this.id = message.id;
    this.username = message.username;
    this.sendToHost({ type: "join", message });
    return message;
  }

  messageCallback(event) {
    const data = event.data;
    if (data && ClientMirror.pendingRequests.has(data.id)) this.handleParentFunctionCallback(data);
    else this.handleMessageFromHost(data);
  }
  handleParentFunctionCallback(data) {
    const { resolve, reject } = ClientMirror.pendingRequests.get(data.id);
    ClientMirror.pendingRequests.delete(data.id);

    if (data.status === "SUCCESS") resolve(data.result);
    else {
      console.log(data.status, data.result);
      reject(new Error(data.error));
    }
  }

  //  allows us to talk directly to the host over the existing game_socket datachannel 
  sendToHost = (...args) => {
    return new Promise((resolve, reject) => {
      const id = ++ClientMirror.messageId;
      ClientMirror.pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({ id, type: "PARENT_CALL", method: "sendMessageToHost", args: ["game_socket"].concat(args) }, "*");
    });
  } 
  //  to call functions on the parent P2PClient
  sendToParent = (method, ...args) => {
    return new Promise((resolve, reject) => {
      const id = ++ClientMirror.messageId;
      ClientMirror.pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({ id, type: "PARENT_CALL", method, args }, "*");
    });
  }

  // override this from your own class that extends this class to implement your message handler
  handleMessageFromHost = (message) => {
    console.warn("[handleMessageFromHost = (message)=> {...}] NOT IMPLEMENTED")
  }
}