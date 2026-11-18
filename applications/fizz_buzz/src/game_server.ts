import { P2PHost } from  "@common/src/p2p_host";

const ANSI_red = "\x1b[31m";
const ANSI_green = "\x1b[32m";
const ANSI_reset = "\x1b[0m";

class User {
  id;
  username;
  data_channel;
  constructor(id: UserId, username: string, dc: RTCDataChannel) {
    this.id = id;
    this.username = username;
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
  yourTurn = "yourTurn",
  joinGame = "joinGame",
  playerLeft = "playerLeft",
  playerJoined = "playerJoined",
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
    super(__dirname);
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
    this.users = shuffleMap(this.users);
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
          game.createUser(message["id"], message["username"], dc);
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

  sendMessageToUser(userId: UserId, message: any) {
    // sends a message to a spesific user
    this.users.get(userId)?.data_channel.send(JSON.stringify(message));
  }
  sendMessage(user: User, message: any){
    user.data_channel.send(JSON.stringify(message));
  }

  returnMessage(dc: RTCDataChannel, message: any) {
    // sends a message to a spesific user
    dc.send(JSON.stringify(message));
  }

  // adds a new user to the list
  createUser(id: UserId, name: string, dc: RTCDataChannel) {
    const user = new User(id, name, dc)
    dc.onclose = () => {
      FizzBuzzGame.instance.users.delete(id);
      this.broadcastMessage({type: MessageTypes.playerLeft, userId: id});
    }

    this.broadcastMessage({type: MessageTypes.playerJoined, userId: id, username: name});
    this.sendMessage(user, {type:MessageTypes.joinGame, users: Array.from(this.users.values()).map(el => {return {userId: el.id, username: el.username}})})
    
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
      this.returnMessage(dc, { type: MessageTypes.notYourTurn, userId: userId, message: this.turnNum });
      return; // not this users turn
    }

    if (this.validateGuess(guess)) {
      console.log("valid guess!");
      //this.returnMessage(dc, { type: MessageTypes.yourGuessCorrect, guess: guess });
      this.broadcastMessage({ type: MessageTypes.correctGuess, userId: userId, guess: guess });
      this.turnNum++;  
    } else {
      console.log("invalid guess!" );
      //this.returnMessage(dc, { type: MessageTypes.yourGuessIncorrect, guess: guess });
      this.broadcastMessage({ type: MessageTypes.incorrectGuess, userId: userId, guess: guess });
      this.initialiseNewGame();
    }
    // send a message to the person whos turn it now is asking them to start
    this.broadcastMessage({type: MessageTypes.yourTurn, userId: Array.from(this.users.values())[(this.turnNum - 1) % this.users.size].id, message: this.turnNum});
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

function shuffleMap(map: Map<UserId, User>) {
  // 1. Convert Map entries into an array of [key, value] pairs
  const entries = Array.from(map.entries());
  
  // 2. Shuffle the entries array using the Fisher-Yates algorithm
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]]; // Swap elements
  }
  
  // 3. Rebuild and return a new Map from the shuffled entries
  return new Map(entries);
}


// start the game
const game = new FizzBuzzGame();

//@ts-ignore
const args = process.argv.slice(2);
const backup_server_url = "wss://localhost:8000/peer_server";
const server_url = args[0] ?? backup_server_url;

game.start(server_url);
