"use strict"
console.log("starting... Main Server");

import https from 'https';
import fs from 'fs';
import path from 'path';
import url from 'url';


// adds integration contexts
import { BaseHandler, TcpClient, findContext, contexts } from './tcpServer';

const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files
const GAME_CLIENT_FILE_DIR = path.join(__dirname, 'game_clients'); // Directory to stored game files
const SERVER_CERT_DIR = process.env.SERVER_CERT_DIR; // Directory to stored game files
const SERVER_KEY_DIR = process.env.SERVER_KEY_DIR; // Directory to stored game files

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


server.listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}`);
    // adds contexts to handle the different request types. 
    contexts["/"] = new FileHandler();

    
    // adds games from the .env file
    const gamehander = new GameHandler(); 
    Array.from(process.env.GAMES).forEach(name => {
         contexts[name] = gamehander;
    });
    
});

// 
function RegisterGame(context){    
    console.log("adding game context",context);
}



console.log("Started file server");



// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler extends BaseHandler {
    HandleGet(client: TcpClient): void {
        var filePath; 
        
        if(client.url.pathname.length == 1) {
            // allows an empty string to redirect to index.html 
            filePath = path.join(WEBSITE_FILE_DIR, "index.html"); 
        } else {
            // grabs the correct path
            filePath = path.join(WEBSITE_FILE_DIR, client.url.pathname.substring(1)); // Remove leading "/"
        }
        client.SendFile(filePath);
    }
}

class GameHandler extends BaseHandler {
    HandleGet(client: TcpClient): void {
        // grabs the correct path
        const filePath = path.join(GAME_CLIENT_FILE_DIR, client.url.pathname.substring(1)); // Remove leading "/"    
        client.SendFile(filePath);
    }
}








class GameRoom {
    id;
    clients;  
    constructor(id){
        this.id = id;
        this.clients = []; 
    }

    AddUser(client : GameClient){
        this.clients.push(client);
    }
    RemoveUser(client : GameClient){
        this.clients.Remove(client);
    }
}

class GameClient {
    name; 
    game_room;
    socket;  
    constructor(name){
        this.name = name; 
        this.game_room;        
    }

    JoinRoom(room){
        this.game_room = room;
        this.game_room.AddUser(this);  
    }
    LeaveRoom(){
        this.game_room.RemoveUser(this); 
    }
}