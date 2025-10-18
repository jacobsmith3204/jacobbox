const form = document.getElementById("gameForm");
const message = document.getElementById("message");

form.addEventListener("submit", function (e) {
    e.preventDefault();


    const roomCode = location.hash;
    const playerName = document.getElementById("playerName").value.trim();

    if (playerName.length === 0) {
        message.textContent = "Please enter your name.";
        message.style.color = "red";
        return;
    }

    // Fake join action
    message.textContent = `🎉 Welcome, ${playerName}! Joining room ${roomCode}...`;
    message.style.color = "green";

    // TODO: Send data to server here
});



var messageTypes = {
    yourGuessCorrect: yourGuessCorrect,
    yourGuessIncorrect: yourGuessIncorrect,
    correctGuess: correctGuess,
    incorrectGuess: incorrectGuess,
    notYourTurn: notYourTurn,
    message: message
}


class Game extends BaseClient {


    OnMessage(event) {

        console.log(event.data);
        if (typeof (event.data) == typeof (String))
            return;

        var data = JSON.parse(event.data);
        messageTypes[data["type"]](data);
    }
}



function yourGuessCorrect(data) {}

function yourGuessIncorrect(data) {}
function correctGuess(data){}

function incorrectGuess(data){}

function notYourTurn(data){}
function message(data){
    console.log(data["message"]);
}


const game = new Game();
game.ConnectToServer();