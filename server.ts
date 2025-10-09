"use strict"
console.log("starting... Main Server");

import https from 'https';
import fs from 'fs';
import path from 'path';
import url from 'url';


// adds integration contexts
import { BaseHandler, TcpClient, findContext, contexts, handleSocketData, UpgradeToWebSocket } from './tcpServer';
import { Console, error } from 'console';
import { notStrictEqual } from 'assert';
import { IncomingMessage } from 'http';
import Stream from 'stream';
import Buffer from 'buffer';
import { report, sourceMapsEnabled } from 'process';
import { Socket } from 'dgram';

const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files
const GAME_CLIENT_FILE_DIR = path.join(__dirname, 'games'); // Directory to stored game files
const SERVER_CERT_DIR = process.env.SERVER_CERT_DIR; // Directory to stored game files
const SERVER_KEY_DIR = process.env.SERVER_KEY_DIR; // Directory to stored game files

var NEXT_PLAYER_ID = 0;
var NEXT_GAME_ID = 0;
var GAME_ROOMS: Map<String, GameRoom> = new Map<String, GameRoom>();


// server options (reads from key/cert files)
const options = {
    key: fs.readFileSync(SERVER_KEY_DIR), // Private key
    cert: fs.readFileSync(SERVER_CERT_DIR) // Certificate
};

// starts the http server
const server = https.createServer(options, function handleServerRequests(req, res) {
    // handles the server requests, finds the closest matching context class instance from 'contexts' and uses it to handle the server
    console.log("new http request... ")
    var client = new TcpClient(req, res);
    var context = findContext(client.url.pathname);
    context.Handle(client);
});








server.listen(PORT, function InitialiseServer() {
    console.log(`Server running at https://localhost:${PORT}`);
    // adds contexts to handle the different request types. 
    contexts["/"] = new FileHandler();
    contexts["/findGame"] = new ServerHandler();
    AddGamesFromFileSystemToContexts();

    // !!TEMPORARY!! adds a gameroom for demo purposes till a test server is up and running
    GAME_ROOMS.set("1234", new GameRoom("1234", null, "demo_game"));
    console.log(GAME_ROOMS);
});



// 
function AddGamesFromFileSystemToContexts() {
    RequestListOfFilesInDir(path.join(__dirname, "games")).then(
        games => {
            games.forEach(name => { contexts[`/${name}`] = new GameHandler(name); });
            console.log("game contexts", contexts);
        }
    );
    function RequestListOfFilesInDir(dir): Promise<Array<string>> {
        try {
            return fs.promises.readdir(dir);
        }
        catch (err) {
            console.error(`Error reading files in directory: ${dir}`, err)
            return null;
        }
    }
}

console.log("Started file server");



// HTTP HANDLERS

// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler extends BaseHandler {
    HandleGet(client: TcpClient): void {
        var filePath;

        if (client.url.pathname.length == 1) {
            // allows an empty string to redirect to index.html 
            filePath = path.join(WEBSITE_FILE_DIR, "index.html");
        } else {
            // grabs the correct path
            filePath = path.join(WEBSITE_FILE_DIR, client.url.pathname);
        }
        client.SendFile(filePath);
    }
}

class ServerHandler extends BaseHandler {
    HandlePost(client: TcpClient): void {
        console.log(`server handler handling request ${client.req.method}`);

        const data = client.data;
        const gameRoom = GameRoom.Find(data["gameCode"]);
        client.SendResponse(200, JSON.stringify({ gameType: gameRoom.gameType }));
    }
}


class GameHandler extends BaseHandler {
    gameName; // allows us to refer to the specific game without having to extract it from the path. 
    constructor(name) {
        super();
        this.gameName = name;
    }

    HandleGet(client: TcpClient): void {
        // grabs the correct path
        var filePath = path.join(GAME_CLIENT_FILE_DIR, client.url.pathname);

        // checks if its a special path that need redirecting. otherwise sends the file. 
        const name = client.url.pathname.replaceAll("/", "");
        switch (name) {
            case this.gameName:
                // removes the need to type game_name/client/index.html; to get the main index file. 
                //console.log(`using default path for game ${this.gameName}`);
                filePath = path.join(GAME_CLIENT_FILE_DIR, `${this.gameName}/client/index.html`);
                break;
            default:
                // loads in in normally; 
                // TIP: if its defaulting to the website handler, use <base href="/[game_name]/client/"> in your index.html file
                // it saves you having to type in long path every time. 
                console.log(`reading from location ${filePath}`);
                break;
        }

        client.SendFile(filePath);
    }
}







// room and class setup

class GameRoom {
    id;
    clients: Map<String, GameClient> = new Map<String, GameClient>();
    socket;
    setupRequest;
    gameType;
    constructor(id, socket, gameType) {
        this.id = id;
        this.socket = socket;
        this.gameType = gameType;
    }

    AddUser(client: GameClient) {
        this.clients.set("", client);
    }
    RemoveUser(client: GameClient) {
        this.clients.delete(client.id);
    }

    static CreateNew(socket, request: object): GameRoom {
        // client
        const gameRoom = new GameRoom(NEXT_GAME_ID++, socket, request["gameType"]);
        gameRoom.setupRequest = request;
        GAME_ROOMS.set(gameRoom.id, gameRoom);
        return gameRoom;
    }
    static Find(gameID: string): GameRoom {
        const room = GAME_ROOMS.get(gameID);
        console.log("searching for room: ", gameID, " room ", room);
        return room;
    }

    SendMessageToAllClients(message) {
        this.clients.forEach((client: GameClient) => this.SendMessageToClient(client, message));
    }
    SendMessageToClient(client: GameClient, message) {
        client.SendMessage(message);
    }
    SendMessage(message) {
        // sends a message back to the server
        if (this.socket != null)
            this.socket.sendText(message);
        else
            console.log(`socket not setup`);
    }
}


class GameClient {
    name: string;
    gameID: string;
    id: string;
    game_room: GameRoom;
    socket;

    constructor(id, socket) {
        this.socket = socket;
        this.id = id;
    }

    static CreateNew(socket, request: object) {
        // fetch game id
        const gameClient = new GameClient(NEXT_PLAYER_ID++, socket);

        // sets name 
        gameClient.SetName(request["name"]);
        // sets game id 
        gameClient.gameID = request["gameID"];
        // finds the right room
        const game = GameRoom.Find(gameClient.gameID);
        if (gameClient.gameID && game)
            gameClient.JoinRoom(game);
        else
            console.log("no room to join")

        // returns the setup object
        return gameClient;
    }

    SetName(name: string) {
        this.name = name;
    }

    JoinRoom(room: GameRoom) {
        this.game_room = room;
        this.game_room.AddUser(this);
    }
    LeaveRoom() {
        this.game_room.RemoveUser(this);
    }

    SendMessageToServer(message) {
        // sends message to this game rooms server
        this.game_room.SendMessage(message);
    }
    SendMessage(message) {
        // sends a message back to this client
        if (this.socket != null)
            this.socket.sendText(message);
        else
            console.log(`socket not setup`);
    }
}



// WEBSOCKET STUFF


// server upgrade request handles the transformation of a tcp/http connection to a websocket connection 
server.on('upgrade', (request: IncomingMessage, socket: Stream.Duplex, headers: Buffer) => {

    console.log(`upgrading \n`, request.headers, request.url);


    // if not directed to the correct /socket address when creating a websocket (it really wouldn't matter though) 
    if (request.method.toUpperCase() != "GET" || request.url != "/socket") {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }
    else {
        // adds some event listeners 
        socket.on('error', () => { console.error("socket: error upgrading") });
        // on data is handled then piped back through to on message. 
        socket.on('data', (data) => handleSocketData(socket, data));

        // the first message will be parsed by this once then and replaced with a new on message after handling the initialisation request. 
        socket.on('message', (message) => {
            console.log("socket recieved first message", message, "parsing to json");
            const data = JSON.parse(message);
            HandleWebsocketInitialisationRequest(socket, data['type'], data['message']);
        });

        console.log("trying to upgrade to websocket...");
        UpgradeToWebSocket(socket, request);

    }
});
console.log("added websocket upgrade request");




// updates the socket.onlistener to one depending on the first response. 
function HandleWebsocketInitialisationRequest(socket, type, message) {
    socket.removeAllListeners('message'); // should remove the onMessage handler so we can reasign them later depending on the . 
    switch (type) {
        case "serverInitialisation":
            const gameRoom = GameRoom.CreateNew(socket, message);
            // adds new on message function. 
            socket.on('message', (message) => {
                var data = JSON.parse(message);
                HandleServerMessage(gameRoom, data["type"], data);
            });
            break;
        case "clientInitialisation":
            const gameClient = GameClient.CreateNew(socket, message);
            // adds new on message function.
            socket.on('message', (message) => {
                //console.log(`type ${type}, ${message} `);
                var data = JSON.parse(message);
                HandleClientMessage(gameClient, data["type"], data);
            });
            break;
    }
}

// HANDLE -- SERVER -- MESSAGES  
function HandleServerMessage(gameRoom: GameRoom, type: string, data: any) {
    const message = data["message"];
    console.log(`server recieved '${type}' message: ${message} `);

    switch (type) {
        case "toClient":
            // sends a message to a particular client
            gameRoom.SendMessageToClient(this.clients.get(data["clientID"]), data);
            break;
        case "toAllClients":
            // sends a message to a particular client
            gameRoom.SendMessageToAllClients(message);
            break;

        default:
            gameRoom.SendMessage(`server request message need format {type: "...", message:"..." }`);
            break;
    }
}

// HANDE -- CLIENT -- MESSAGES
function HandleClientMessage(gameClient: GameClient, type: string, data: any) {
    const message = data["message"];
    console.log(`client recieved '${type}' message: ${message}`);

    // switch statment for all the request types 
    switch (type) {
        case "toServer":
            // relays a message from the client to the server
            gameClient.SendMessageToServer(message);
            break;

        default:
            // sends a reminder to send message in this format
            gameClient.SendMessage(`client request message need format {type: "...", message:"..." }`);
            break;
    }
}


