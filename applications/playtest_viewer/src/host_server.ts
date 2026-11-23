import { P2PHost } from "@common/src/p2p_host";

const ANSI_red = "\x1b[31m";
const ANSI_green = "\x1b[32m";
const ANSI_reset = "\x1b[0m";


type UserType = "playtester" | "viewer";
class User {
  id;
  username;
  data_channel;
  type: UserType; 
  constructor(id: UserId, username: string, dc: RTCDataChannel, type: UserType) {
    this.id = id;
    this.username = username;
    this.data_channel = dc;
    this.type = type;
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

class HostServer extends P2PHost {
  static users: Map<UserId, User> = new Map<UserId, User>(); // <id,user>
  static viewing_key: string = "password";

  constructor() {
    super(__dirname);
    // Handle messages from clients
    P2PHost.dataChannels["game_socket"] = (dc) => {
      dc.onopen = () => console.log(`${ANSI_green}GAME_SOCKET CHANNEL TO NEW USER NOW OPEN ${ANSI_reset}`);
      dc.onmessage = (event) => HostServer.handleMessage(event, dc);
    };
  }



  static handleMessage(event: any, dc: RTCDataChannel) {
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
          HostServer.createUser(message["id"], message["username"], dc, message["viewing_key"] == HostServer.viewing_key ? "viewer" : "playtester");
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

  static broadcastMessage(message: any) {
    // sends a message to all connected clients
    HostServer.users.forEach((user) => user?.data_channel.send(JSON.stringify(message)));
  }

  static sendMessageToUser(userId: UserId, message: any) {
    // sends a message to a spesific user
    HostServer.users.get(userId)?.data_channel.send(JSON.stringify(message));
  }
  static sendMessage(user: User, message: any) {
    user.data_channel.send(JSON.stringify(message));
  }
  static returnMessage(dc: RTCDataChannel, message: any) {
    // sends a message to a spesific user
    dc.send(JSON.stringify(message));
  }

  // adds a new user to the list
  static createUser(id: UserId, name: string, dc: RTCDataChannel, userType: UserType) {
    // creates the user
    const user = new User(id, name, dc, userType); 
    // handles cleanup
    dc.onclose = () => {
      HostServer.users.delete(id);
      HostServer.broadcastMessage({ type: MessageTypes.playerLeft, userId: id });
    }
    // send connection message to the user
    HostServer.sendMessage(user, { type: MessageTypes.joinGame, privilege: user.type }); 
    // adds the user to the map to lookup later
    HostServer.users.set(id, user);
  }
}





/* ===================   start the game    ====================== */
const args = process.argv.slice(2);
const backup_server_url = "wss://localhost:8000/peer_server";
const server_url = args[0] ?? backup_server_url;
new HostServer().start(server_url);
