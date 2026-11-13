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

      startClient(gameId, username).catch(() => {
          this.OnFail("failed to connect \n verify game code and try again");
        });
    } else {
      this.OnFail(gameId === "" ? "Please enter a game code." : "Invalid code format. Use 4-10 letters/numbers.");
    }
  }
}

//
const form = new SigninForm();
document.getElementById("gameCodeForm").addEventListener("submit", form.SubmitGameCode.bind(form));





