/*

!!!! DOESNT WORK just use my website for now 
https://jacobsmith3204.ngrok.io/Projects/Games/peer%20connections/index.html

*/

"use strict"
console.log("starting... Main Server");

import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import url from 'url';
import { IncomingMessage, ServerResponse } from 'http';



// adds integration contexts
const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'public'); // Directory to stored game files
const SERVER_CERT_DIR = process.env.SERVER_CERT_DIR ?? ""; // Directory to stored game files
const SERVER_KEY_DIR = process.env.SERVER_KEY_DIR ?? ""; // Directory to stored game files

// server options (reads from key/cert files)
const options = {
    key: fs.readFileSync(SERVER_KEY_DIR), // Private key
    cert: fs.readFileSync(SERVER_CERT_DIR) // Certificate
};


// starts the http server
const server = https.createServer(options, (req, res) => {
    // handles the server requests, finds the closest matching context class instance from 'contexts' and uses it to handle the server
    console.log("new http request... ")
    var url = new URL(req.url as string);
    findContext(url.pathname).handle(req, res);
});


class GameRoom{
    static ROOMS = new Map<String, GameRoom>();
    static CreateNew(res: ServerResponse){
        
        const hostId = "1234";
        this.ROOMS.set(hostId, new GameRoom(hostId));
    }

    constructor(hostId: string){
        this.hostId = hostId;
    }

	hostId: string;
	queueing_clients = new Map<number, ServerResponse>();

	// list of all active rooms
}
const GAME_ROOMS = new Map<string, GameRoom>();



server.listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}`);
    // adds contexts to handle the different request types. 
    contexts["/"] = new FileHandler();

    contexts["/peer_server"] = new ServerHandler();
    contexts["/peer_client"] = new ClientHandler();
});

console.log("Started file server");






// server.contexts are added to this
export const contexts: { [key: string]: BaseHandler } = {};
// searches the contexts keys to find the closest matching value, required to completely match the context string. 
export function findContext(target: string): BaseHandler {
    var closestMatch = 0;
    var closestVal = 100000;
    var currentVal;

    var contextKeys = Object.keys(contexts);
    for (let i = 0; i < contextKeys.length; i++) {
        currentVal = levenshtein(target, contextKeys[i]);
        //console.log("testing: ", target ,"against", contextKeys[i], "result", currentVal); 
        if (currentVal < closestVal) {
            closestMatch = i;
            closestVal = currentVal;
        }
        if (closestVal == 0)
            break;
    }
    //console.log("closest context with val: ",  closestVal, contextKeys[closestMatch]); 
    return Object.values(contexts)[closestMatch] as BaseHandler;

    // function to find closest matching string 
    function levenshtein(a: string, b: string) {
        // 
        if (a === b) return 0;
        if (!a.startsWith(b))
            return 100000;
        // should have already filtered out most case by here. 
        const matrix = Array(a.length + 1)
            .fill(null)
            .map(() => Array(b.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,    // Deletion
                    matrix[i][j - 1] + 1,    // Insertion
                    matrix[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        return matrix[a.length][b.length];
    }
}


// HTTP HANDLERS
interface BaseHandler { handle(req: IncomingMessage, res: ServerResponse): void }


// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler implements BaseHandler {
    handle(req: IncomingMessage, res: ServerResponse): void {
        var filePath;
        var url = new URL(req.url as string);

        if (url.pathname.length == 1) {
            // allows an empty string to redirect to index.html 
            filePath = path.join(WEBSITE_FILE_DIR, "index.html");
        } else {
            // grabs the correct path
            filePath = path.join(WEBSITE_FILE_DIR, url.pathname);
        }
        SendFile(res, filePath);
    }
}


class ServerHandler implements BaseHandler {
    handle(req: IncomingMessage, res: ServerResponse): void {
        // upgrade to a socket connection
     
		// creates a new room which will handle the rest of the requests.
		GameRoom room = GameRoom.CreateNew(client);
		// sends a first response back to the host (NOT REQUIRED FUNCTIONALITY)
		room.client.Push("{\"response\":\"started game\", \"host\":\"" + room.hostId + "\"}");
    
    }
}


class ClientHandler implements BaseHandler {
    handle(req: IncomingMessage, res: ServerResponse): void {
        
    }
}






/*

function SendResponse( res: ServerResponse, code: number, data: object | string, headers?:object) {
    if (!headers)
        headers ??= GetContentHeaders();
    res.writeHead(code, headers.toString());
    if (typeof data === 'object' && !(data instanceof Buffer || data instanceof Uint8Array))
        data = JSON.stringify(data);
    res.end(data);
}

function SendFile( res: ServerResponse, filePath: string) {
    console.log("sending file", filePath);
    fs.readFile(filePath, function NormalFile(err, data) {
        if (err) {
            SendResponse(res, 404, 'File not found');
            console.log("couldn't find file: ", filePath);
        } else {
            SendResponse(res, 200, data, GetContentHeaders(filePath));
            console.log("sent file: ", filePath, "with headers", GetContentHeaders(filePath));
        }
    });
}
// uses a switch statement to return the correct headers based on the targets file extention eg: .png
export function GetContentHeaders(target = ""): object {
    if (!target)
        return { 'Content-Type': 'text/plain' };

    let match = (target.match(/\.[\w.]+$/) as any)[0]; // gets the file extention matches extentions with 2 "." just need to add it as a case
    //console.log(match);
    switch (match) {
        case ".html": return { 'Content-Type': 'text/html; charset=UTF-8' };
        case ".css": return { 'Content-Type': 'text/css' };
        case ".ico": return { 'Content-Type': 'image' };
        case ".png": return { 'Content-Type': 'image/png' };
        case ".svg": return { 'Content-Type': 'image/svg+xml' , "Vary": "Accept-Encoding" };
        case ".jpg": return { 'Content-Type': 'image/jpg' };
        case ".webp": return { 'Content-Type': 'image/webp' };
        case ".js": return { 'Content-Type': 'application/javascript' };
        case ".xml": return { 'Content-Type': 'application/xml' };
        case ".mp3": return { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', };
        default: return { 'Content-Type': 'text/plain' };
    }
}

*/