process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // needed this to ignore unauthorised connections (aka wss://localhost). 
const server_url = 'wss://localhost:8000/socket';
const ws = new WebSocket(server_url);


type UserId = string;

// Handle new connections
ws.addEventListener('open', (e) => {
    console.log('Client connected');


    

    ws.send(JSON.stringify({ type: "hostInitialisation", message: FizzBuzzGame.initialisationMessage }));

});


// Handle messages from clients
ws.addEventListener('message', event => {

    console.log(`Received: ${event.data}`);
    try {
        const data = JSON.parse(event.data); 
        const type = data["type"]; 
        //{type:"", message: {obj}}
        switch(type){
            case "initialisation":
                console.log("initilisation", data["message"]);

            break; 
            case "join": 
                // name: , id:
                console.log("join" ,data["message"]);
                game.createUser(data["message"]["id"] , data["message"]["name"])
            case "guess":
                game.processGuess(data["message"]["user"],data["message"]["guess"])
            break; 
        }


        //ws.send(`Echo: ${message}`); // Echo back the message
    }
    catch(e){
        console.error(e);
    }
});

// Handle connection closure
ws.addEventListener('close', () => {
    console.log('Client disconnected');
});

// Handle errors
ws.addEventListener('error', error => {
    console.error('WebSocket error:', error);
});


type WSMessage<T> = {
    type: "toAllClients" | "toClient",
    clientID?: UserId,
    message: T
}

// TODO: Turn these into a library so that we can use them wherever
function broadcastMessage<T>(ws: WebSocket, message: T){
    ws.send(JSON.stringify({
        message: message,
        type: "toAllClients"
        
    } as WSMessage<T>));
}

function sendDirectMessage<T>(ws: WebSocket,userId: UserId, message: T){
    ws.send(JSON.stringify({
        message: message,
        type: "toClient",
        clientID: userId
    } as WSMessage<T>));
}

enum MessageTypes {
    yourGuessCorrect= "yourGuessCorrect",
    yourGuessIncorrect= "yourGuessIncorrect",
    correctGuess= "correctGuess",
    incorrectGuess= "incorrectGuess",
    notYourTurn= "notYourTurn"
}


class FizzBuzzGame{
    users : Map<String, User> = new  Map<String, User>(); // <id,user>
    socket; 
    static initialisationMessage = {
        gameType: "demo_game",
        maxPlayers: 10,
        minPlayers: 2,
    };

    turnNum; 

    constructor(socket){
        this.socket = socket; 
    }

 

    initialiseNewGame(){
        this.turnNum = 1; 
    }

    createUser(id: UserId, name : string){
        this.users.set(id, new User(id, name));
    }
    
    processGuess(userId: UserId , guess: "string"){
        if (userId !== this.currentTurnUser()){
            // TODO: send a message saying "WAIT YOUR TURN"
            sendDirectMessage(this.socket, userId, {type: MessageTypes.notYourTurn});
            return; // not this users turn
        }
        let correctGuess = this.validateGuess(userId, guess);
        if (correctGuess){
            sendDirectMessage(this.socket, userId, {type: MessageTypes.yourGuessCorrect, guess: guess});
            broadcastMessage(this.socket, {type: MessageTypes.correctGuess, userId: userId, guess: guess});
        } else {
            sendDirectMessage(this.socket, userId, {type: MessageTypes.yourGuessIncorrect, guess: guess});
            broadcastMessage(this.socket, {type: MessageTypes.incorrectGuess, userId: userId, guess: guess});
            
        }
    }

    sendCorrect(userId: UserId){
        this.socket.send(JSON.stringify({type: "", }));
    }

    currentTurnUser() : UserId{
        /** 
         * Returns the userId of the user whose turn it is
         */
        return Array.from(this.users.keys())[this.turnNum % this.users.size] as string;
    }

    validateGuess(user, message){   
        
        
        // check if the message was correct
        if(this.turnNum % 5 && this.turnNum % 3)
            return message == 'fizzbuzz'; // fizz-buzz
        else if(this.turnNum % 5)
            return message == 'buzz'; // buzz
        else if (this.turnNum % 3)
            return message == 'fizz'; // fizz
        else 
            return (this.turnNum == message); // number
    }
}

class User{
    id; 
    name; 
    constructor(id, name = undefined){
        this.id = id;
        this.name = name;       
    }
}

const game = new FizzBuzzGame(ws); 