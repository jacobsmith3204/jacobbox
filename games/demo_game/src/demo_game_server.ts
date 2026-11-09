import { P2PHost } from "./p2p_host";

const ANSI_red = "\x1b[31m";
const ANSI_green = "\x1b[32m";
const ANSI_reset = "\x1b[0m";

class User {
  id;
  name;
  data_channel;
  constructor(id: UserId, name: string, dc: RTCDataChannel) {
    this.id = id;
    this.name = name;
    this.data_channel = dc;
  }
}

export type UserId = number;

export enum MessageTypes {
  yourGuessCorrect = "yourGuessCorrect",
  yourGuessIncorrect = "yourGuessIncorrect",
  correctGuess = "correctGuess",
  incorrectGuess = "incorrectGuess",
  notYourTurn = "notYourTurn",
}

class FizzBuzzGame extends P2PHost {
  static instance: FizzBuzzGame;
  users: Map<UserId, User> = new Map<UserId, User>(); // <id,user>
  turnNum!: number;
  static initialisationMessage = {
    gameType: "demo_game",
    maxPlayers: 10,
    minPlayers: 2,
  };

  constructor() {
    super();
    FizzBuzzGame.instance = this;

    // Handle messages from clients
    P2PHost.dataChannels["game_socket"] = (dc) => {
      dc.onopen = () => console.log(`${ANSI_green}CHANNEL TO NEW USER NOW OPEN ${ANSI_reset}`);
      dc.onmessage = (event) => FizzBuzzGame.instance.handleMessage(event, dc);
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
          game.processGuess(message["id"], message["guess"], dc);
          break;
        case undefined:
        default:
          if (typeof data.message === "string") {
            data.message += " - pong";
            dc.send(JSON.stringify(data));
            console.log("ponged message ", data);
          }
          break;
      }
    } catch (e) {
      console.error(e);
    }
  }

  broadcastMessage(message: any) {
    // sends a message to all connected clients
    this.users.forEach((user) => user?.data_channel.send(JSON.stringify(message)));
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
  createUser(id: UserId, name: string, dc: RTCDataChannel) {
    const user = new User(id, name, dc)


    dc.onclose = () => FizzBuzzGame.instance.users.delete(id);
    FizzBuzzGame.instance.users.set(id, user);
  }


  // returns the userId of the user whose turn it is
  currentTurnUser() {
    const current_user_index = (this.turnNum - 1) % this.users.size;
    return Array.from(this.users.keys())[current_user_index];
    }

  processGuess(userId: UserId, guess: string, dc: RTCDataChannel) {

    if (userId != this.currentTurnUser()) {
      // TODO: send a message saying "WAIT YOUR TURN"
      this.returnMessage(dc, { type: MessageTypes.notYourTurn , message: this.turnNum });
      return; // not this users turn
    }

    if (this.validateGuess(guess)) {
      console.log("valid guess!");
      this.returnMessage(dc, { type: MessageTypes.yourGuessCorrect, guess: guess });
      this.broadcastMessage({ type: MessageTypes.correctGuess, userId: userId, guess: guess });
    } else {
      console.log("invalid guess!" );
      this.returnMessage(dc, { type: MessageTypes.yourGuessIncorrect, guess: guess });
      this.broadcastMessage({ type: MessageTypes.incorrectGuess, userId: userId, guess: guess });
    }
  }

  validateGuess(guess: string) {

    const correctGuess = this.correctGuess();
    console.log("guessed", guess, "correct is", correctGuess );
    return (guess == correctGuess);
  }

  correctGuess() {
    if (this.turnNum % 5 == 0 && this.turnNum % 3 == 0)
      return  "fizzbuzz"; // fizz-buzz
    else if (this.turnNum % 5 == 0)
      return  "buzz"; // buzz
    else if (this.turnNum % 3 == 0)
      return "fizz"; // fizz
    else return this.turnNum; // number

  }
}

// start the game
const game = new FizzBuzzGame();

//@ts-ignore
const args = process.argv.slice(2);
const backup_server_url = "wss://localhost:8000/peer_server";
const server_url = args[0] ?? backup_server_url;

game.start(server_url);
