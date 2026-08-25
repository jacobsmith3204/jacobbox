import { P2PHost } from './P2Phost';

class User {
    id;
    name;
    data_channel;
    constructor(id: UserId, name: string, dc : RTCDataChannel) {
        this.id = id;
        this.name = name;
        this.data_channel = dc; 
    }
}

export type UserId = string;


export enum MessageTypes {
    yourGuessCorrect = "yourGuessCorrect",
    yourGuessIncorrect = "yourGuessIncorrect",
    correctGuess = "correctGuess",
    incorrectGuess = "incorrectGuess",
    notYourTurn = "notYourTurn"
}


class FizzBuzzGame extends P2PHost {
    users: Map<String, User> = new Map<String, User>(); // <id,user>
    turnNum = 1;
    static initialisationMessage = {
        gameType: "demo_game",
        maxPlayers: 10,
        minPlayers: 2,
    };

    constructor() {
        super();

        const game = this;
        // Handle messages from clients
        P2PHost.dataChannels["game_socket"] = (dc) => {
            dc.onopen = () => console.log("channel to new user now open");
            dc.onmessage = (event)=> game.handleMessage(event, dc);
        };

        // restarts the game
        this.initialiseNewGame();
    }

    initialiseNewGame() {
        console.log("starting new game");
        this.turnNum = 1;
    }

    handleMessage(event: any, dc: RTCDataChannel) {
        console.log(`fizzbuzz data_channel received: ${event.data}`);
        try {
            const data = JSON.parse(event.data);
            //{type:"", message: {obj}}
            const type = data["type"];
            const message = data["message"];
            
            switch (type) {
                case "join":
                    // name: , id:
                    console.log("join", message);
                    game.createUser(message["id"], message["name"], dc);
                    break; 
                case "guess":
                    game.processGuess(message["user"], message["guess"], dc)
                    break;
            }
        }
        catch (e) {
            console.error(e);
        }
    }


    broadcastMessage(message: any) {
        // sends a message to all connected clients
        this.users.forEach(user => user?.data_channel.send(JSON.stringify(message)));
    }

    sendDirectMessage(userId: UserId, message: any) {
        // sends a message to a spesific user
        this.users.get(userId)?.data_channel.send(JSON.stringify(message));
    } 
    returnMessage(dc: RTCDataChannel, message: any) {
        // sends a message to a spesific user
        dc.send(JSON.stringify(message));
    }



    // adds a new user to the list
    createUser = (id: UserId, name: string, dc: RTCDataChannel) => this.users.set(id, new User(id, name, dc));
    // returns the userId of the user whose turn it is
    currentTurnUser = () => Array.from(this.users.keys())[this.turnNum % this.users.size];

    processGuess(userId: UserId, guess: string, dc: RTCDataChannel) {
        if (userId !== this.currentTurnUser()) {
            // TODO: send a message saying "WAIT YOUR TURN"
            this.returnMessage(dc, { type: MessageTypes.notYourTurn });
            return; // not this users turn
        }

        if (this.validateGuess(guess)) {
            this.returnMessage(dc, { type: MessageTypes.yourGuessCorrect, guess: guess });
            this.broadcastMessage({ type: MessageTypes.correctGuess, userId: userId, guess: guess });
        } else {
            this.returnMessage(dc, { type: MessageTypes.yourGuessIncorrect, guess: guess });
            this.broadcastMessage({ type: MessageTypes.incorrectGuess, userId: userId, guess: guess });
        }
    }

    validateGuess(message: string) {
        // check if the message was correct
        if (this.turnNum % 5 && this.turnNum % 3)
            return message == 'fizzbuzz'; // fizz-buzz
        else if (this.turnNum % 5)
            return message == 'buzz'; // buzz
        else if (this.turnNum % 3)
            return message == 'fizz'; // fizz
        else
            return (this.turnNum == Number.parseInt(message)); // number
    }
}


// start the game
const game = new FizzBuzzGame();


//@ts-ignore
const args = process.argv.slice(2);
const backup_server_url = 'wss://localhost:8000/socket';
const server_url = args[0] ?? backup_server_url;

game.start(server_url);