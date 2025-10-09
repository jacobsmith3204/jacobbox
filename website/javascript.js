class SigninForm {
  messageEl;
  codeInputEl;
  constructor() {
    this.messageEl = document.getElementById('message');
    this.codeInputEl = document.getElementById('gameCodeInput');
  }

  GetCode() {
    return this.codeInputEl.value.trim();
  }
  ValidateCode(code) {
    const codePattern = /^[A-Za-z0-9]{4,10}$/;
    return (code !== '') && codePattern.test(code);
  }
  OnMessage(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = 'grey';
  }
  OnSuccess(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = 'green';
  }
  OnFail(message) {
    this.messageEl.textContent = message;
    this.messageEl.style.color = 'red';
  }


  SubmitGameCode(e) {
    e.preventDefault(); // Prevent form submission
    const gameCode = this.GetCode();


    if (this.ValidateCode(gameCode)) {
      this.OnMessage("attempting login");

      // sends a request to the server, should return with info about the game type etc
      var req = new XMLHttpRequest();
      req.addEventListener("load", load.bind(this));
      req.open("POST", "/findGame");
      req.send(JSON.stringify({ gameCode: gameCode }));

      //we then forward to the game page
      function load(event) {
        //console.log(event.target.response);
        const message = event.target.response; 
        
        try {     
          const data = JSON.parse(message); 
          console.log("POST response is: ",data);
          this.OnSuccess(`Game code "${gameCode}" submitted successfully!`);
          // uses the response to redirect to the games index page (doesn't need index.html since the server handles it spesifically);
          window.location.assign(`${data["gameType"]}`);
        }
        catch (e) {
          console.error(e);
          this.OnFail(`invalid response ${message}`);
        }
      }
    }
    else {
      this.OnFail((gameCode === '') ? 'Please enter a game code.' : 'Invalid code format. Use 4-10 letters/numbers.');
    }
  }
}




const form = new SigninForm();
document.getElementById('gameCodeForm').addEventListener('submit', form.SubmitGameCode.bind(form));
