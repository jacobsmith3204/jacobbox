process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // needed this to ignore unauthorised connections (aka wss://localhost). 
const server_url = 'wss://localhost:8000/socket';
const ws = new WebSocket(server_url);




// Handle new connections
ws.addEventListener('open', (e) => {
    console.log('Client connected');


    

    ws.send(JSON.stringify({ type: "serverInitialisation", message: FizzBuzzGame.initialisationMessage }));

});


// Handle messages from clients
ws.addEventListener('message', event => {

    console.log(`Received: ${event.data}`);
    try {
        const data = JSON.parse(event.data); 
        const type = data["type"]; 
        
        switch(type){
            case "initialisation":
                console.log("initilisation", data["message"]);

            break; 
            case "join": 
                console.log("join" ,data["message"]);
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

 

    InitialiseNewGame(){
        this.turnNum = 1; 
    }

    CreateUser(id, name){
        this.users.set(id, new User(id, name));
    }

    ValidateTurn(user, message){   
        // check its its the users turn
        const keysArray = Array.from(this.users.keys());
        if(keysArray.indexOf(user) != this.turnNum % keysArray.length){
            return false; 
        } 
        
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