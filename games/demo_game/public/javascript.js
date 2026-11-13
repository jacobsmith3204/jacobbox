console.log(`%c STARTING IFRAME INITIALISATION`, "color: lightgreen; font-weight: bold");



// Inside the Cross-Domain Iframe
let messageId = 0;
const pendingRequests = new Map();
let currentGuess = "";




class ClientMirror {
  static instance;

  static clients = new Map();

  constructor() {
    ClientMirror.instance = this;
    // Listen for the parent's response
    window.addEventListener("message", ClientMirror.messageCallback);

    console.log("sending init to parent");
    window.parent.postMessage({type:"INIT"}, "*");
  }

  async signin() {

    const { id, username } = await this.sendToParent("getUserDetails");
    this.id = id;
    ClientMirror.addUser(id, username);
    this.username = username;
    client.sendToHost({ type: "join", message: { id, username } });
  }


  static messageCallback(event) {
    const data = event.data;
    if (data && pendingRequests.has(data.id)) ClientMirror.handleParentFunctionCallback(data);
    else ClientMirror.instance.handleMessageFromHost(data);
  }
  static handleParentFunctionCallback(data) {
    const { resolve, reject } = pendingRequests.get(data.id);
    pendingRequests.delete(data.id);

    if (data.status === "SUCCESS") resolve(data.result);
    else {
      console.log(data.status, data.result);
      reject(new Error(data.error));

    }
  }


  //  to call functions on the parent P2PClient
  sendToHost = (...args) => {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({ id, type: "PARENT_CALL", method: "sendMessageToHost", args: ["game_socket"].concat(args) }, "*");
    });
  } //  to call functions on the parent P2PClient
  sendToParent = (method, ...args) => {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({ id, type: "PARENT_CALL", method, args }, "*");
    });
  }

  handleMessageFromHost = (message) => {
    const data = JSON.parse(message);
    //console.log(data);
    const messageEl = document.getElementById("message");
    let isYourTurn = data.userId == this.id;

    switch (data.type) {
      case "connected":
        this.signin();
        break;
      case "correctGuess":
        messageEl.innerText = `${ClientMirror.getUsername(data.userId)} guessed correctly ${data.guess}`;
        ClientMirror.clearAll();
        ClientMirror.say(data.userId, data.guess);
        // moves the guessed to the end of the line
        form.querySelector("#users").prepend(ClientMirror.clients.get(data.userId));
        break;
      case "incorrectGuess":
        messageEl.innerText = ` ${ClientMirror.getUsername(data.userId)} guessed incorrectly ${data.guess} `;
        ClientMirror.clearAll();
        ClientMirror.say(data.userId, `incorrect ${data.guess}`);
        break;
      case "yourTurn":
        console.log("is your turn ", isYourTurn, data.userId, this.id);
        if (isYourTurn) {
          messageEl.innerText = ` your turn - ${data.message} `;
          ClientMirror.say(data.userId, "!");
          ClientMirror.turn(data.userId, true);
        }
        else {
          ClientMirror.turn(data.userId, false);
        }
        break;
      case "notYourTurn":
        messageEl.innerText = ` not your turn - ${data.message} `;
        ClientMirror.say(data.userId, "not your turn");
         ClientMirror.turn(data.userId, false);
        break;
      case "joinGame":
        console.log("joined game adding existing users");
        for (let user of data.users) {
          console.log(user);
          ClientMirror.addUser(user.userId, user.username);
        }
        break;
      case "playerJoined":
        ClientMirror.addUser(data.userId, data.username);
        break;
      case "playerLeft":
        ClientMirror.removeUser(data.userId);
        break;

      default:
        messageEl.innerText = message;
        break;
    }
    // allows makes users pop up if its their turn, otherwise makes them drop
  }


  static getUsername (userId) {return ClientMirror.clients.get(userId).lastElementChild.innerText}

  static clearAll() {
    const list = form.querySelectorAll("#users > *");
    console.log("clearing")
    for(let el of list){
      const id = Number.parseInt(el.getAttribute("id"));
      ClientMirror.say(id, "");
      ClientMirror.turn(id, false);
      console.log(el, id );
    }
  }


  static addUser(userId, username) {
    form.querySelector("#users").insertAdjacentHTML("beforeend", `<span id="${userId}"> <img src="combatant-svgrepo-com.svg"><label > ${username}</label></span>`);

    const el = form.querySelector("#users").lastElementChild;
    console.log("added user: ", userId, el);
    ClientMirror.clients.set(userId, el);
  }
  static removeUser(userid) {
    ClientMirror.clients.get(userid).remove();
    ClientMirror.clients.delete(userid);
  }

  static turn(userid, show) {
    const el = ClientMirror.clients.get(userid);
       if (!el) {
      console.warn("element doesnt exist",el);
      return;
    }
     if (show)
      el.classList.add("turn");
    else
      el.classList.remove("turn");
  }
  static say(userid, guess, show = true) {
    const el = ClientMirror.clients.get(userid);
    if (!el) {
      console.warn("element doesnt exist",el);
      return;
    }
    if (show)
      el.classList.add("say");
    else
      el.classList.remove("say");

    el.style.setProperty('--dynamic-text', `"${guess.toString()}"`);
    // 
    console.log(userid, el, "saying ", guess);
  }
}

let client = window.clientMirror = new ClientMirror();

const form = document.forms["gameForm"];

// allows doing things when the value is updated (like animations or whatever)
const display = document.getElementById("display");
display.addEventListener("click", () => {
  const el = display.firstElementChild;
  currentGuess = undefined;
  if (!el) {
    display.innerHTML = `<input type="text" id="inputField" name="input" placeholder="number | fizz | buzz | fizzbuzz"
  autocomplete="off" 
  autocorrect="off" 
  autocapitalize="off" 
  spellcheck="false"
    >`;
    display.firstElementChild.focus();
  }
});

function UpdateGuess(val) {
  //console.log(val);
  // do things here like trigger animations etc 
  currentGuess = val;
  display.innerText = currentGuess;
  //console.log(form["submit"]);
  form["submit"].focus();
}


async function DoMove() {
  // if current guess is null (using keyboard input) we add the keyboard input
  currentGuess ??= form["input"].value.toLowerCase();
  console.log("trying guess", currentGuess ); // , "keyboard field", form["input"]?.value);
  // makes sure we have something to send
  if (currentGuess.trim() === "") {
    console.warn("guess can't be empty");
    return;
  }

  // gets everything needed to send the message to the server
  const guess = currentGuess;
  const username = client.username;
  const id = client.id;
  client.sendToHost({ type: "guess", message: { id, username, guess } });
  // resets guess; 
  UpdateGuess("");
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  DoMove();
});





const submitBtn = document.getElementById("submit");
submitBtn.addEventListener("click", DoMove);



// loops through and assigns the numberpad button events
for (let i = 0; i <= 9; i++) {
  const number = i;
  form[`#${i}`].addEventListener("click", () => { UpdateGuess(`${Number.isNaN(Number.parseInt(currentGuess)) ? "" : currentGuess}${number}`) });
}

// 
form["fizz"].addEventListener("click", () => UpdateGuess(`fizz`));
// buzz can be connected as fizzbuzz
form["buzz"].addEventListener("click", () => UpdateGuess(`${currentGuess == "fizz" ? "fizz" : ""}buzz`))
// deletes 4 if fizz or buzz otherwise just the last char
form["del"].addEventListener("click", () => UpdateGuess(currentGuess.slice(0, currentGuess.length - (currentGuess.endsWith("fizz") || currentGuess.endsWith("buzz") ? 4 : 1))));

