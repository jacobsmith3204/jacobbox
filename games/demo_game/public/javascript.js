console.log(`%c STARTING IFRAME INITIALISATION`, "color: lightgreen; font-weight: bold");



// Inside the Cross-Domain Iframe
let messageId = 0;
const pendingRequests = new Map();

var user = {};

// Listen for the parent's response
window.addEventListener("message", (event) => {
  const data = event.data;
  if (data && pendingRequests.has(data.id)) handleParentFunctionCallback(data);
  else handleMessageFromHost(data);

});

function handleParentFunctionCallback(data) {
  const { resolve, reject } = pendingRequests.get(data.id);
  pendingRequests.delete(data.id);

  if (data.status === "SUCCESS") resolve(data.result);
  else reject(new Error(data.error));
}

function handleMessageFromHost(message) {
  console.log(message);
}

// Helper function to call the parent
function callParent(method, ...args) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    // Send to window.parent
    // Replace '*' with your exact parent domain for security
    window.parent.postMessage(
      {
        id,
        type: "PARENT_CALL",
        method,
        args,
      },
      "*",
    );
  });
}


// button to ping server
function TalkToServer() {
  callParent("sendMessageToHost", "game_socket", "Hello from the iframe!");
}


// button to send join request to server
async function JoinServer() {
  const { id, username } = await callParent("getUserDetails");
  user.id = id;
  user.username = username;
  callParent("sendMessageToHost", "game_socket", { type: "join", message: { id, username } });
}
async function DoMove() {
  const guess = 1;
  const username = user.username;
  const id = user.id;
  callParent("sendMessageToHost", "game_socket", { type: "guess", message: { id, username, guess } });
}



JoinServer().then(DoMove);


