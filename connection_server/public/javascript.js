// ================================================================
//  FORM THAT STARTS THE CONNECTION PROCESS TO THE P2PCLIENT
// ==============================================================
class SigninForm {
  messageEl;
  codeInputEl;
  usernameInputEl;
  constructor() {
    this.messageEl = document.getElementById("message");
    this.codeInputEl = document.getElementById("gameCodeInput");
    this.usernameInputEl = document.getElementById("username");
  }

  GetCode() {
    return this.codeInputEl.value.trim();
  }
  GetUserName() {
    return this.usernameInputEl.value.trim();
  }
  ValidateCode(code) {
    const codePattern = /^[A-Z0-9]{4,10}$/;
    return code !== "" && codePattern.test(code);
  }
  OnMessage(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = "grey";
    console.log(message);
  }
  OnSuccess(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = "green";
    console.log(message);
  }
  OnFail(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = "red";
    console.warn(message);
  }

  async SubmitGameCode(e) {
    e.preventDefault(); // Prevent form submission
    const gameId = this.GetCode().toUpperCase();
    const username = this.GetUserName();

    if (this.ValidateCode(gameId)) {
      this.OnMessage(`attempting to join game ${gameId}`);

      localStorage.setItem("gameID", gameId);
      localStorage.setItem("username", username);

      // starts the p2p client connection process

      startClient(gameId, username).then(WaitTillConnectedToIframe).then(BindEventsToChildIframe).catch(() => {
          this.OnFail("failed to connect \n verify game code and try again");
        });
    } else {
      this.OnFail(gameId === "" ? "Please enter a game code." : "Invalid code format. Use 4-10 letters/numbers.");
    }
  }
}

// connects to the iframe when its loaded
async function WaitTillConnectedToIframe() {
  console.log("waiting till iframe connected")
  // create a promise that waits for the iframe page to finish
  const iframe = document.getElementById("p2pFrame");
  console.assert(iframe);
  const { promise, resolve } = Promise.withResolvers();
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') resolve(iframe);
  iframe.addEventListener("load", () => resolve(iframe), { once: true });
  return promise;
}

//
const form = new SigninForm();
document.getElementById("gameCodeForm").addEventListener("submit", form.SubmitGameCode.bind(form));



// loads the local storage values from the last session back into the form
window.addEventListener("load", () => {
  const form = document.getElementById("gameCodeForm");

  form.elements["gameCodeInput"].value = localStorage.getItem("gameID");
  form.elements["username"].value = localStorage.getItem("username");
});

// lets me reload the contents of the iframe without having to constantly sign in again
function reloadIframe() {
  const iframe = document.getElementById("p2pFrame");
  if (iframe) iframe.src = iframe.src;
}
window.reloadIframe = reloadIframe;



// ==================================================
// ALLOWS MESSAGES TO BE PASSED FROM THE IFRAME
// ==================================================


function BindEventsToChildIframe(iframe) {
  console.log("linking parent DOM client and iframe");
  P2PClient.instance["onClientMessage"] = (event) => {
    iframe.contentWindow.postMessage(event.data);
  };

}

window.addEventListener("message", async (event) => {
  const { id, type, method, args } = event.data;

  // Only handle actions meant for parent execution
  if (type === "PARENT_CALL") {
    try {
      if (typeof P2PClient.instance[method] !== "function") {
        throw new Error(`Method ${method} does not exist on parent`);
      }

      // Execute and await the method
      const result = await P2PClient.instance[method](...args);

      // Reply to the iframe that sent the message
      event.source.postMessage({ id, status: "SUCCESS", result }, event.origin);
    } catch (err) {
      event.source.postMessage({ id, status: "ERROR", error: err.message }, event.origin);
    }
  }
});
