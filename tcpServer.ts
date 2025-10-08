import fs from 'fs';
import url from 'url';
import https from 'https';
import crypto from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import Stream from 'stream';
import { error } from 'console';
import { Duplex } from 'stream';
import { send } from 'process';

// server.contexts are added to this
export const contexts = {};

// searches the contexts keys to find the closest matching value, required to completely match the context string. 
export function findContext(target): BaseHandler {
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
    function levenshtein(a, b) {
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


// uses a switch statement to return the correct headers based on the targets file extention eg: .png
export function GetContentHeaders(target = ""): object {
    if (!target)
        return { 'Content-Type': 'text/plain' };

    let match = target.match(/\.[\w.]+$/)[0]; // gets the file extention matches extentions with 2 "." just need to add it as a case
    //console.log(match);
    switch (match) {
        case ".html": return { 'Content-Type': 'text/html; charset=UTF-8' };
        case ".css": return { 'Content-Type': 'text/css' };
        case ".ico": return { 'Content-Type': 'image' };
        case ".png": return { 'Content-Type': 'image/png' };
        case ".jpg": return { 'Content-Type': 'image/jpg' };
        case ".webp": return { 'Content-Type': 'image/webp' };
        case ".js": return { 'Content-Type': 'application/javascript' };
        case ".xml": return { 'Content-Type': 'application/xml' };
        case ".mp3": return { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', };
        default: return { 'Content-Type': 'text/plain' };
    }
}

// a reprentation of a user/client.Request can be passed through the diffent methods.
// contains the http request and response objects to comunicate back to the client, in adition to some functionality to simplify basic responses. 
export class TcpClient {

    req; //request data 
    res; //response endpoint to finish the message
    url;
    queries;

    body;// text version of post request body
    data;// json version of post request body

    constructor(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
        this.req = req; //request data 
        this.res = res; //response endpoint to finish the message
        this.url = url.parse(req.url, true);
        this.queries = this.url.query;
    }


    SendResponse(code: Number, data, headers = undefined) {
        if (!headers)
            headers = GetContentHeaders();
        this.res.writeHead(code, headers);
        if (typeof data === 'object' && !(data instanceof Buffer || data instanceof Uint8Array))
            data = JSON.stringify(data);
        this.res.end(data);
    }

    SendFile(filePath: string) {
        console.log("sending file", filePath);
        fs.readFile(filePath, function NormalFile(err, data) {
            if (err) {
                this.SendResponse(404, 'File not found');
                console.log("couldn't find file: ", filePath);
            } else {
                this.SendResponse(200, data, GetContentHeaders(filePath));
                console.log("sent file: ", filePath, "with headers", GetContentHeaders(filePath));
            }
        }.bind(this));
    }
}





// barebones handler, extend from this for new contexts/applications
export class BaseHandler {
    // gives some handles to override in the subclasses
    Handle(client: TcpClient): void {
        try {
            switch (client.req.method) {
                case 'GET':
                    this.HandleGet(client);
                    break;
                case 'POST':
                    // waits till we have all the data concatinated before calling handlePost 
                    client.body = '';
                    client.req.on('data', chunk => client.body += chunk);
                    client.req.on('end', function () {
                        client.data = JSON.parse(client.body);
                        this.HandlePost(client);
                    }.bind(this));
                    break;
                default:
                    this.HandleExceptions(client);
                    break;
            }
        } catch (e) {
            console.error(e);
            client.res
        }
    }

    // overrideable functions for the subsclasses 
    HandleGet(client: TcpClient): void {
        console.error("'HandleGet' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandlePost(client: TcpClient): void {
        console.error("'HandlePost' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandleExceptions(client: TcpClient): void {
        console.log("couldn't handle", client.req.method);
        client.SendResponse(405, 'Method Not Allowed');
    }
}












// === websocket stuff ====



// reading/processing raw data 


type AnySocket = Duplex & {
    __ws?: {
        buffer: Buffer,
        fragmentedOpcode?: number,
        fragmentedBuffers?: Buffer[],
        closed?: boolean
    }
};


// upgrades an sends the websocket upgrade response 
export function UpgradeToWebSocket(socket: AnySocket, request: IncomingMessage)  {
    socket.write(GetWebSocketUpgradeResponse(request));
    socket.__ws = {
        buffer: Buffer.alloc(0),
        fragmentedOpcode: undefined,
        fragmentedBuffers: [],
        closed: false
    };

    // adds controls for sendText & sendBinary functions from websocket. 
    socket["sendText"] = (message) => sendText(socket, message);
    socket["sendBinary"] = (message) => sendBinary(socket, message);
}



function GetWebSocketUpgradeResponse(request: IncomingMessage): string {


    const key = request.headers['sec-websocket-key'];  // might need to change depending on case sensitivity.
    if (!key) {
        //console.log("finding header: sec-websocket-key", Object.keys(headers), headers['sec-websocket-key']);
        throw new Error("request missing header: 'sec-websocket-key'")
    }
    const magicString = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    const encoded = crypto.createHash('sha1').update(key + magicString).digest('base64');

    // 
    const message = `HTTP/1.1 101 Switching Protocols\r\n` +
        `Connection: Upgrade\r\n` +
        `Upgrade: websocket\r\n` +
        `Sec-WebSocket-Accept: ${encoded}\r\n\r\n`;

    console.log("websocket upgrade response:\n", message);

    return message;
}





export function handleSocketData(socket: AnySocket, chunk: Buffer) {
    // append incoming chunk to accumulated buffer

    socket.__ws!.buffer = Buffer.concat([socket.__ws!.buffer, chunk]);
    processBuffer(socket);


}



/** Process accumulated buffer, extracting as many frames as available */
function processBuffer(socket: AnySocket) {
    const state = socket.__ws!;
    let buffer = state.buffer;
    let offset = 0;

    while (true) {



        const remaining = buffer.length - offset;
        if (remaining < 2) break; // need at least 2 bytes for header

        const firstByte = buffer[offset];
        const secondByte = buffer[offset + 1];

        const fin = (firstByte & 0x80) !== 0;
        const opcode = firstByte & 0x0f;
        const masked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;

        let headerLen = 2;

        if (payloadLen === 126) {
            // requires 2 more bytes
            if (remaining < headerLen + 2) break;
            payloadLen = buffer.readUInt16BE(offset + headerLen);
            headerLen += 2;
        } else if (payloadLen === 127) {
            // requires 8 more bytes
            if (remaining < headerLen + 8) break;
            // read as BigInt then convert to Number (note: may overflow > Number.MAX_SAFE_INTEGER)
            const big = buffer.readBigUInt64BE(offset + headerLen);
            const numeric = Number(big);
            payloadLen = numeric;
            headerLen += 8;
        }

        // mask key (client -> server must be masked)
        let maskKey: Buffer | undefined;
        if (masked) {
            if (remaining < headerLen + 4) break;
            maskKey = buffer.slice(offset + headerLen, offset + headerLen + 4);
            headerLen += 4;
        } else {
            // According to RFC, clients must mask payloads; unmasked client frames are protocol violation.
            // We'll treat it as an error if we see an unmasked client frame.
            console.warn('Received unmasked frame from client (protocol violation)');
        }

        // Ensure full payload is available
        if (remaining < headerLen + payloadLen) break;

        // Extract payload
        const payloadStart = offset + headerLen;
        const payloadEnd = payloadStart + payloadLen;
        const payload = buffer.slice(payloadStart, payloadEnd);

        // Move offset forward for next iteration
        offset = payloadEnd;

        // Unmask payload if needed
        let unmaskedPayload = payload;
        if (masked && maskKey) {
            unmaskedPayload = Buffer.alloc(payloadLen);
            for (let i = 0; i < payloadLen; i++) {
                unmaskedPayload[i] = payload[i] ^ maskKey[i % 4];
            }
        }

        // Handle opcodes
        if (opcode === 0x0) {
            // continuation frame
            if (state.fragmentedOpcode === undefined) {
                // unexpected continuation
                console.warn('Unexpected continuation frame with no active fragmented message');
            } else {
                state.fragmentedBuffers!.push(unmaskedPayload);
                if (fin) {
                    const whole = Buffer.concat(state.fragmentedBuffers!);
                    const finalOpcode = state.fragmentedOpcode;
                    // dispatch completed fragmented message
                    HandleCompletedData(socket, finalOpcode, whole);
                    // reset fragmentation state
                    state.fragmentedOpcode = undefined;
                    state.fragmentedBuffers = [];
                }
            }
        } else if (opcode === 0x1 || opcode === 0x2) {
            // text (0x1) or binary (0x2)
            if (fin) {
                HandleCompletedData(socket, opcode, unmaskedPayload);
            } else {
                // start fragmented message
                state.fragmentedOpcode = opcode;
                state.fragmentedBuffers = [unmaskedPayload];
            }
        } else if (opcode === 0x8) {
            // connection close
            // payload may contain 2-byte code + reason string
            handleCloseFrame(socket, unmaskedPayload);
            return; // likely closed, stop processing
        } else if (opcode === 0x9) {
            // ping -> respond with pong with identical payload
            sendControlFrame(socket, 0xA, unmaskedPayload); // pong
        } else if (opcode === 0xA) {
            // pong (usually unsolicited; can be used for keepalive)
            // ignore or mark ping as satisfied if you track pings
        } else {
            console.warn('Unhandled opcode:', opcode);
        }

        // continue loop to try parse next frame
    }

    // keep leftover bytes that weren't processed
    state.buffer = buffer.slice(offset);
}

// SENDS THE MESSAGE BACK TO THE SOCKET TO HANDLE NORMALLY
function HandleCompletedData(socket: AnySocket, opcode: number, data: Buffer) {
    if (opcode === 0x1) {
        // text
        const text = data.toString('utf8');
        console.log('Received text message:', text);
        socket.emit("message", "text", text);
    } else if (opcode === 0x2) {
        // binary
        console.log('Received binary message, length=', data.length);
        socket.emit("message", "binary", data);
    }
}

/** Handle close: reply close and destroy socket */
function handleCloseFrame(socket: AnySocket, payload: Buffer) {
    let code: number | undefined;
    let reason: string | undefined;
    if (payload.length >= 2) {
        code = payload.readUInt16BE(0);
        if (payload.length > 2) {
            reason = payload.slice(2).toString('utf8');
        }
    }
    console.log('Received close frame', code, reason);

    // Send close back if not already closed
    if (!socket.__ws!.closed) {
        const responsePayload = payload; // echo provided code/reason if present
        sendControlFrame(socket, 0x8, responsePayload);
    }
    socket.__ws!.closed = true;
    socket.end();
}

/** Send control frames (opcode 0x8 close, 0x9 ping, 0xA pong). Server MUST NOT mask frames it sends. */
function sendControlFrame(socket: AnySocket, opcode: number, payload?: Buffer) {
    if (!payload) payload = Buffer.alloc(0);
    // control frame must have payload length <= 125 per RFC
    if (payload.length > 125) {
        console.warn('Control frame payload too large; truncating.');
        payload = payload.slice(0, 125);
    }
    const firstByte = 0x80 | (opcode & 0x0f); // FIN=1 + opcode
    const secondByte = payload.length; // server frames are not masked => mask bit 0

    const header = Buffer.alloc(2);
    header[0] = firstByte;
    header[1] = secondByte;

    const frame = Buffer.concat([header, payload]);
    socket.write(frame);
}





/** Send a text frame (unmasked) */
function sendText(socket: AnySocket, message: string) {
    const payload = Buffer.from(message, 'utf8');
    console.log("sending text: " + message);
    return sendDataFrame(socket, 0x1, payload);

}

/** Send a binary frame (unmasked) */
function sendBinary(socket: AnySocket, data: Buffer) {
    console.log("sending binary...");
    return sendDataFrame(socket, 0x2, data);
}

/** Generic data frame sender (handles extended lengths) */
function sendDataFrame(socket: AnySocket, opcode: number, payload: Buffer) {
    try {
        const finAndOpcode = 0x80 | (opcode & 0x0f);
        let header: Buffer;

        const len = payload.length;
        if (len < 126) {
            header = Buffer.alloc(2);
            header[0] = finAndOpcode;
            header[1] = len; // mask bit = 0 for server
        } else if (len < 65536) {
            header = Buffer.alloc(4);
            header[0] = finAndOpcode;
            header[1] = 126;
            header.writeUInt16BE(len, 2);
        } else {
            // 64-bit length
            header = Buffer.alloc(10);
            header[0] = finAndOpcode;
            header[1] = 127;
            // writeUInt64BE not available pre-Node 12; use BigInt if available
            const big = BigInt(len);
            header.writeBigUInt64BE(big, 2);
        }

        const frame = Buffer.concat([header, payload]);
        socket.write(frame);

        return true;
    }
    catch (err) {
        console.error(err);
        return false;
    }
}