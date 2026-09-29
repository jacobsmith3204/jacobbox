import https from "https";
import fs from "fs";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { lookup as lookupMimeType } from "mime-types";

import { fileURLToPath } from "url";


const PUBLIC_DIR = path.resolve(
    __dirname,
    "..",
    "public"
);

interface PeerMessage {
    request?: string;
    answer?: unknown;
    offer?: unknown;
    host?: string;
    id?: number;
    [key: string]: unknown;
}

interface QueuedClient {
    id: number;
    response: ServerResponse;
}

/**
 * Stores a host WebSocket and all clients currently waiting
 * for that host to respond with an offer.
 */
class GameRoom {
    static readonly ROOMS = new Map<string, GameRoom>();

    readonly hostId: string;
    readonly client: WebSocket;

    private readonly queueingClients =
        new Map<number, QueuedClient>();

    constructor(client: WebSocket) {
        this.client = client;
        this.hostId = GameRoom.generateHostId();

        GameRoom.ROOMS.set(this.hostId, this);

        console.log("created room with id", this.hostId);

        //
        // Host WebSocket messages
        //
        this.client.on("message", (data: any) => {
            try {
                this.onMessage(data.toString());
            } catch (error) {
                console.error("Error handling host message:", error);
            }
        });

        //
        // Host disconnected
        //
        this.client.on("close", () => {
            this.destroy();
        });

        this.client.on("error", (error: any) => {
            console.error("Host websocket error:", error);
            this.destroy();
        });

        //
        // Tell host the game has started.
        //
        this.send({
            response: "started game",
            host: this.hostId,
        });
    }

    /**
     * Generate a 4-character host code.
     *
     * Equivalent to:
     *
     * Utilities.GenerateRandomString(4).toUpperCase()
     */
    private static generateHostId(): string {
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        let result = "";

        for (let i = 0; i < 4; i++) {
            result += chars[
                crypto.randomInt(0, chars.length)
            ];
        }

        //
        // Avoid accidentally creating an ID that already exists.
        //
        if (GameRoom.ROOMS.has(result)) {
            return GameRoom.generateHostId();
        }

        return result;
    }

    /**
     * Send JSON to the host.
     */
    private send(message: unknown): void {
        if (this.client.readyState !== WebSocket.OPEN) {
            return;
        }

        this.client.send(JSON.stringify(message));
    }

    /**
     * Handle messages received from the host.
     *
     * This corresponds to GameRoom.OnMessage() in Java.
     */
    private onMessage(message: string): void {
        console.log("got message", message);

        let request: PeerMessage;

        try {
            request = JSON.parse(message);
        } catch {
            console.error("Invalid JSON received from host");
            return;
        }

        //
        // Host sent an offer to a client.
        //
        if (request.offer !== undefined) {
            if (
                !request.host ||
                request.id === undefined
            ) {
                console.error(
                    "Offer is missing host or id"
                );
                return;
            }

            const room =
                GameRoom.ROOMS.get(request.host);

            if (!room) {
                console.error(
                    "Room does not exist:",
                    request.host
                );
                return;
            }

            const queuedClient =
                room.queueingClients.get(request.id);

            if (!queuedClient) {
                console.error(
                    "Client does not exist:",
                    request.id
                );
                return;
            }

            //
            // Send the host's offer back to the
            // original /peer_client HTTP request.
            //
            if (!queuedClient.response.writableEnded) {
                sendJson(
                    queuedClient.response,
                    request
                );
            }

            //
            // Remove it from the queue.
            //
            room.queueingClients.delete(
                request.id
            );

            console.log(
                room.hostId,
                "completed offer to",
                request.id
            );
        }
    }

    /**
     * Add an HTTP client to the waiting queue.
     */
    addClient(
        clientId: number,
        response: ServerResponse
    ): void {
        this.queueingClients.set(clientId, {
            id: clientId,
            response,
        });

        //
        // If the client disconnects before the host
        // responds, remove it from the queue.
        //
        response.on("close", () => {
            this.queueingClients.delete(clientId);
        });
    }

    /**
     * Forward a message to the host.
     */
    sendToHost(message: unknown): void {
        this.send(message);
    }

    /**
     * Remove the room.
     */
    destroy(): void {
        //
        // Don't destroy twice.
        //
        if (!GameRoom.ROOMS.has(this.hostId)) {
            return;
        }

        GameRoom.ROOMS.delete(this.hostId);

        //
        // Notify clients waiting for an offer.
        //
        for (const client of this.queueingClients.values()) {
            if (!client.response.writableEnded) {
                sendJson(client.response, {
                    error: "host disconnected",
                });
            }
        }

        this.queueingClients.clear();

        console.log(
            "removing room",
            this.hostId
        );
    }

    /**
     * Find an existing room.
     */
    static get(
        hostId: string
    ): GameRoom | undefined {
        return GameRoom.ROOMS.get(hostId);
    }
}

/**
 * Handle POST /peer_client
 */
async function handleClient(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    try {
        const body = await readJsonBody(req);

        //
        // Client wants to find a game.
        //
        if (body.request !== undefined) {
            console.log(
                "handling request for offer",
                body
            );

            handleRequest(res, body);
            return;
        }

        //
        // Client has received an offer and is
        // returning an answer.
        //
        if (body.answer !== undefined) {
            console.log(
                "handling answer from offer",
                body
            );

            handleAnswer(res, body);
            return;
        }

        sendJson(res, {
            error:
                "needs a request or answer field in the request body",
        });
    } catch (error) {
        console.error(error);

        if (!res.writableEnded) {
            sendJson(res, {
                error: "not a valid request",
            });
        }
    }
}

/**
 * Equivalent to ClientHandler.handleRequest()
 *
 * Client asks the host to find/create a peer connection.
 */
function handleRequest(
    res: ServerResponse,
    body: PeerMessage
): void {
    const room = getValidRoom(body);

    if (!room) {
        sendJson(res, {
            error: `room does not exist ${body.host ?? ""
                }`,
        });

        return;
    }

    //
    // Generate an ID for this client request.
    //
    const clientId =
        crypto.randomInt(1, 2 ** 31 - 1);

    //
    // Keep the HTTP response open until the host
    // sends us an offer.
    //
    room.addClient(
        clientId,
        res
    );

    //
    // Add the client ID and host ID to the
    // message sent to the host.
    //
    body.id = clientId;
    body.host = room.hostId;

    //
    // Send request to host WebSocket.
    //
    room.sendToHost(body);

    console.log(
        "sent request to host, expecting offer via websocket"
    );
}

/**
 * Equivalent to ClientHandler.handleAnswer()
 *
 * Client sends its answer back to the host.
 */
function handleAnswer(
    res: ServerResponse,
    body: PeerMessage
): void {
    const room = getValidRoom(body);

    if (!room) {
        sendJson(res, {
            error: `room does not exist ${body.host ?? ""
                }`,
        });

        return;
    }

    if (body.id === undefined) {
        sendJson(res, {
            error:
                "room does not exist, or missing an id",
        });

        return;
    }

    //
    // Forward answer to host.
    //
    room.sendToHost(body);

    //
    // Tell the client the transaction completed.
    //
    sendJson(res, {
        response: "completed",
    });

    console.log(
        "sent request to host, should complete transaction"
    );
}

/**
 * Validate that a room exists and its host
 * WebSocket is still alive.
 */
function getValidRoom(
    request: PeerMessage
): GameRoom | null {
    if (!request.host) {
        return null;
    }

    const room =
        GameRoom.get(request.host);

    if (!room) {
        return null;
    }

    if (
        room.client.readyState ===
        WebSocket.CLOSED ||
        room.client.readyState ===
        WebSocket.CLOSING
    ) {
        return null;
    }

    return room;
}

/**
 * Read and parse a JSON HTTP request body.
 */
function readJsonBody(
    req: IncomingMessage
): Promise<PeerMessage> {
    return new Promise(
        (resolve, reject) => {
            let data = "";

            req.setEncoding("utf8");

            req.on("data", (chunk) => {
                data += chunk;
            });

            req.on("end", () => {
                try {
                    const parsed =
                        JSON.parse(data);

                    resolve(parsed);
                } catch {
                    reject(
                        new Error(
                            "Invalid JSON"
                        )
                    );
                }
            });

            req.on("error", reject);
        }
    );
}

/**
 * Send a JSON HTTP response.
 */
function sendJson(
    res: ServerResponse,
    body: unknown
): void {
    if (res.writableEnded) {
        return;
    }

    const json =
        JSON.stringify(body);

    res.statusCode = 200;
    res.setHeader(
        "Content-Type",
        "application/json"
    );

    res.setHeader(
        "Content-Length",
        Buffer.byteLength(json)
    );

    res.end(json);
}

/* ============================================================
 * HTTPS SERVER
 * ============================================================
 */




function serveStaticFile(
    req: IncomingMessage,
    res: ServerResponse
): void {
    if (!req.url) {
        res.statusCode = 400;
        res.end("Bad request");
        return;
    }

    let pathname: string;

    try {
        pathname = decodeURIComponent(
            new URL(
                req.url,
                "https://localhost"
            ).pathname
        );
    } catch {
        res.statusCode = 400;
        res.end("Bad request");
        return;
    }

    if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.resolve(
        PUBLIC_DIR,
        "." + pathname
    );

    console.log(
        "Static request:",
        pathname,
        "->",
        filePath
    );

    //
    // Prevent directory traversal.
    //
    if (
        filePath !== PUBLIC_DIR &&
        !filePath.startsWith(
            PUBLIC_DIR + path.sep
        )
    ) {
        console.log("Blocked path traversal:", filePath);

        res.statusCode = 403;
        res.end("Forbidden");
        return;
    }

    fs.stat(
        filePath,
        (error, stats) => {
            if (error) {
                console.error(
                    "File does not exist:",
                    filePath,
                    error.message
                );

                res.statusCode = 404;
                res.end("Not found");
                return;
            }

            if (!stats.isFile()) {
                console.error(
                    "Not a file:",
                    filePath
                );

                res.statusCode = 404;
                res.end("Not found");
                return;
            }

            const contentType =
                lookupMimeType(filePath) ||
                "application/octet-stream";

            console.log(
                "Serving:",
                filePath,
                contentType
            );

            res.statusCode = 200;
            res.setHeader(
                "Content-Type",
                contentType
            );

            if (req.method === "HEAD") {
                res.end();
                return;
            }

            const stream =
                fs.createReadStream(filePath);

            stream.on("error", (error) => {
                console.error(
                    "Error reading file:",
                    error
                );

                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end("Internal server error");
                } else {
                    res.destroy();
                }
            });

            stream.pipe(res);
        }
    );
}



const httpsServer =
    https.createServer(
        {
            key: fs.readFileSync(
                "./certs/server.key"
            ),

            cert: fs.readFileSync(
                "./certs/server.cert"
            ),
        },

        async (req, res) => {
            //
            // WebRTC signaling endpoint.
            //
            if (
                req.method === "POST" &&
                req.url === "/peer_client"
            ) {
                await handleClient(
                    req,
                    res
                );

                return;
            }

            //
            // Only serve static files for GET/HEAD.
            //
            if (
                req.method === "GET" ||
                req.method === "HEAD"
            ) {
                serveStaticFile(req, res);
                return;
            }

            res.statusCode = 404;
            res.end("Not found");
        }
    );






/* ============================================================
 * WEBSOCKET SERVER
 * ============================================================
 *
 * noServer = true means the HTTPS server handles the actual
 * HTTP upgrade and then hands the connection to ws.
 */

const wss =
    new WebSocketServer({
        noServer: true,
    });

/**
 * HTTPS -> WebSocket upgrade.
 *
 * /peer_server becomes a WebSocket connection.
 */
httpsServer.on(
    "upgrade",
    (req, socket, head) => {
        //
        // Only /peer_server is allowed to upgrade.
        //
        if (
            req.url !== "/peer_server"
        ) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(
            req,
            socket,
            head,
            (ws: WebSocket) => {
                wss.emit(
                    "connection",
                    ws,
                    req
                );
            }
        );
    }
);

/**
 * Host connected to /peer_server.
 */
wss.on(
    "connection",
    (ws: WebSocket) => {
        console.log(
            "peer host connected"
        );

        new GameRoom(ws);
    }
);

/* ============================================================
 * START SERVER
 * ============================================================
 */

const PORT = 8000;

httpsServer.listen(
    PORT,
    () => {
        console.log(
            `Peer server listening on https://localhost:${PORT}`
        );
    }
);
