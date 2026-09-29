import https from "https";
import fs from "fs";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { lookup as lookupMimeType } from "mime-types";

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const PORT = 8000;

// Maximum size of a /peer_client JSON request body.
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

// How long a client is allowed to wait for the host
// to respond with an offer.
const CLIENT_REQUEST_TIMEOUT = 30_000; // 30 seconds

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
    timeout: NodeJS.Timeout;
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

        console.log(
            "created room with id",
            this.hostId
        );

        //
        // Host WebSocket messages
        //
        this.client.on("message", (data) => {
            try {
                this.onMessage(data.toString());
            } catch (error) {
                console.error(
                    "Error handling host message:",
                    error
                );
            }
        });

        //
        // Host disconnected
        //
        this.client.on("close", () => {
            this.destroy();
        });

        this.client.on("error", (error) => {
            console.error(
                "Host websocket error:",
                error
            );

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
     * Check whether a client ID is currently queued.
     *
     * This is attached to GameRoom through a prototype method
     * so the core room structure remains simple.
     */
    hasClient(
        this: GameRoom,
        clientId: number
    ): boolean {
        return (
            (
                this as unknown as {
                    queueingClients: Map<
                        number,
                        QueuedClient
                    >;
                }
            ).queueingClients.has(
                clientId
            )
        );
    };

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
        if (
            this.client.readyState !==
            WebSocket.OPEN
        ) {
            return;
        }

        this.client.send(
            JSON.stringify(message)
        );
    }

    /**
     * Handle messages received from the host.
     *
     * This corresponds to GameRoom.OnMessage() in Java.
     */
    private onMessage(message: string): void {
        console.log(
            "got message",
            message
        );

        let request: PeerMessage;

        try {
            const parsed: unknown =
                JSON.parse(message);

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                console.error(
                    "Host message must be a JSON object"
                );

                return;
            }

            request = parsed as PeerMessage;
        } catch {
            console.error(
                "Invalid JSON received from host"
            );

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

            //
            // The message came from this room's host,
            // so make sure it claims to belong to this room.
            //
            if (
                request.host !==
                this.hostId
            ) {
                console.error(
                    "Host ID mismatch:",
                    request.host,
                    this.hostId
                );

                return;
            }

            //
            // Find the HTTP client waiting for this offer.
            //
            const queuedClient =
                this.queueingClients.get(
                    request.id
                );

            if (!queuedClient) {
                console.error(
                    "Client does not exist:",
                    request.id
                );

                return;
            }

            //
            // Cancel the timeout.
            //
            clearTimeout(
                queuedClient.timeout
            );

            //
            // Send the host's offer back through
            // the original /peer_client HTTP request.
            //
            if (
                !queuedClient.response
                    .writableEnded
            ) {
                sendJson(
                    queuedClient.response,
                    request
                );
            }

            //
            // Remove it from the queue.
            //
            this.queueingClients.delete(
                request.id
            );

            console.log(
                this.hostId,
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
        //
        // Prevent a request from hanging forever if
        // the host never responds.
        //
        const timeout =
            setTimeout(() => {
                const queued =
                    this.queueingClients.get(
                        clientId
                    );

                //
                // Make sure this is still the same
                // queued HTTP response.
                //
                if (
                    queued?.response !==
                    response
                ) {
                    return;
                }

                this.queueingClients.delete(
                    clientId
                );

                if (
                    !response.writableEnded
                ) {
                    sendJson(
                        response,
                        {
                            error:
                                "host did not respond in time",
                        }
                    );
                }

                console.log(
                    this.hostId,
                    "timed out client",
                    clientId
                );
            }, CLIENT_REQUEST_TIMEOUT);

        this.queueingClients.set(
            clientId,
            {
                id: clientId,
                response,
                timeout,
            }
        );

        //
        // If the client disconnects before the host
        // responds, remove it from the queue.
        //
        response.on("close", () => {
            const queued =
                this.queueingClients.get(
                    clientId
                );

            //
            // Only remove the entry if this is
            // still the same HTTP response.
            //
            if (
                queued?.response ===
                response
            ) {
                clearTimeout(
                    queued.timeout
                );

                this.queueingClients.delete(
                    clientId
                );
            }
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
        if (
            !GameRoom.ROOMS.has(
                this.hostId
            )
        ) {
            return;
        }

        GameRoom.ROOMS.delete(
            this.hostId
        );

        //
        // Notify clients waiting for an offer.
        //
        for (
            const client
            of this.queueingClients.values()
        ) {
            clearTimeout(
                client.timeout
            );

            if (
                !client.response
                    .writableEnded
            ) {
                sendJson(
                    client.response,
                    {
                        error:
                            "host disconnected",
                    }
                );
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
        return GameRoom.ROOMS.get(
            hostId
        );
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
        const body =
            await readJsonBody(req);

        //
        // Client wants to find a game.
        //
        if (
            body.request !== undefined
        ) {
            console.log(
                "handling request for offer",
                body
            );

            handleRequest(
                res,
                body
            );

            return;
        }

        //
        // Client has received an offer and is
        // returning an answer.
        //
        if (
            body.answer !== undefined
        ) {
            console.log(
                "handling answer from offer",
                body
            );

            handleAnswer(
                res,
                body
            );

            return;
        }

        sendJson(
            res,
            {
                error:
                    "needs a request or answer field in the request body",
            }
        );
    } catch (error) {
        console.error(
            "Error handling client request:",
            error
        );

        if (!res.writableEnded) {
            sendJson(
                res,
                {
                    error:
                        "not a valid request",
                }
            );
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
    //
    // Match the Java server's missing-host behavior.
    //
    if (!body.host) {
        sendJson(
            res,
            {
                error:
                    "no host code provided",
            }
        );

        return;
    }

    const room =
        getValidRoom(body);

    if (!room) {
        sendJson(
            res,
            {
                error:
                    `room does not exist ${body.host}`,
            }
        );

        return;
    }

    //
    // Generate an ID for this client request.
    //
    let clientId: number;

    do {
        clientId =
            crypto.randomInt(
                1,
                2 ** 31 - 1
            );
    } while (
        room.hasClient(clientId)
    );

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
    //
    // Match the Java server's missing-host behavior.
    //
    if (!body.host) {
        sendJson(
            res,
            {
                error:
                    "no host code provided",
            }
        );

        return;
    }

    const room =
        getValidRoom(body);

    if (!room) {
        sendJson(
            res,
            {
                error:
                    `room does not exist ${body.host}`,
            }
        );

        return;
    }

    if (
        body.id === undefined
    ) {
        sendJson(
            res,
            {
                error:
                    "room does not exist, or missing an id",
            }
        );

        return;
    }

    //
    // Forward answer to host.
    //
    room.sendToHost(body);

    //
    // Tell the client the transaction completed.
    //
    sendJson(
        res,
        {
            response: "completed",
        }
    );

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
        GameRoom.get(
            request.host
        );

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
            let finished = false;

            req.setEncoding(
                "utf8"
            );

            req.on(
                "data",
                (chunk: string) => {
                    if (finished) {
                        return;
                    }

                    data += chunk;

                    if (
                        Buffer.byteLength(
                            data,
                            "utf8"
                        ) >
                        MAX_BODY_SIZE
                    ) {
                        finished = true;

                        reject(
                            new Error(
                                "Request body too large"
                            )
                        );

                        req.destroy();
                    }
                }
            );

            req.on(
                "end",
                () => {
                    if (finished) {
                        return;
                    }

                    finished = true;

                    try {
                        const parsed: unknown =
                            JSON.parse(data);

                        if (
                            typeof parsed !==
                            "object" ||
                            parsed === null ||
                            Array.isArray(parsed)
                        ) {
                            reject(
                                new Error(
                                    "JSON body must be an object"
                                )
                            );

                            return;
                        }

                        resolve(
                            parsed as PeerMessage
                        );
                    } catch {
                        reject(
                            new Error(
                                "Invalid JSON"
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                (error) => {
                    if (!finished) {
                        finished = true;
                        reject(error);
                    }
                }
            );
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
    if (
        res.writableEnded
    ) {
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
 * ADDITIONAL GameRoom HELPER
 * ============================================================
 */

//
// Kept outside the class above to make the main class
// structure closely resemble the Java implementation.
//
declare module "ws" {
    interface WebSocket {
        __peerServerRoomCheck?: boolean;
    }
}

/* ============================================================
 * STATIC FILE SERVER
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
        pathname =
            decodeURIComponent(
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

    if (
        pathname === "/"
    ) {
        pathname =
            "/index.html";
    }

    const filePath =
        path.resolve(
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
            PUBLIC_DIR +
            path.sep
        )
    ) {
        console.log(
            "Blocked path traversal:",
            filePath
        );

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
                lookupMimeType(
                    filePath
                ) ||
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

            if (
                req.method ===
                "HEAD"
            ) {
                res.end();
                return;
            }

            const stream =
                fs.createReadStream(
                    filePath
                );

            stream.on(
                "error",
                (error) => {
                    console.error(
                        "Error reading file:",
                        error
                    );

                    if (
                        !res.headersSent
                    ) {
                        res.statusCode = 500;
                        res.end(
                            "Internal server error"
                        );
                    } else {
                        res.destroy();
                    }
                }
            );

            stream.pipe(res);
        }
    );
}

/* ============================================================
 * HTTPS SERVER
 * ============================================================
 */

const httpsServer = https.createServer(
    {
        key: fs.readFileSync("./certs/server.key"),
        cert: fs.readFileSync("./certs/server.cert"),
    },

    async (req, res) => {
        console.log(
            "========== HTTP REQUEST =========="
        );

        console.log(
            req.method,
            req.url
        );

        console.log(
            "Headers:",
            req.headers
        );

        //
        // WebRTC signaling endpoint.
        //
        if (
            req.method === "POST" &&
            req.url === "/peer_client"
        ) {
            console.log(
                "========== PEER CLIENT REQUEST =========="
            );

            await handleClient(
                req,
                res
            );

            return;
        }

        //
        // Static files.
        //
        if (
            req.method === "GET" ||
            req.method === "HEAD"
        ) {
            serveStaticFile(
                req,
                res
            );

            return;
        }

        res.statusCode = 404;
        res.end("Not found");
    }
);


httpsServer.on(
    "secureConnection",
    (tlsSocket) => {
        console.log(
            "TLS connection established:",
            tlsSocket.remoteAddress
        );
    }
);

httpsServer.on(
    "tlsClientError",
    (error) => {
        console.error(
            "TLS client error:",
            error
        );
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
        console.log(
            "========== WEBSOCKET UPGRADE RECEIVED =========="
        );

        console.log("URL:", req.url);
        console.log("Method:", req.method);
        console.log("Headers:", req.headers);

        socket.on("error", (error) => {
            console.error(
                "WebSocket upgrade socket error:",
                error
            );
        });

        socket.on("close", () => {
            console.log(
                "WebSocket upgrade socket closed"
            );
        });

        if (req.url !== "/peer_server") {
            console.log(
                "Rejecting WebSocket URL:",
                req.url
            );

            socket.destroy();
            return;
        }

        console.log(
            "Passing socket to ws.handleUpgrade()"
        );

        wss.handleUpgrade(
            req,
            socket,
            head,
            (ws) => {
                console.log(
                    "========== WEBSOCKET UPGRADE SUCCESS =========="
                );

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
    (ws: WebSocket, req: IncomingMessage) => {
        console.log(
            "========== PEER HOST CONNECTED =========="
        );

        console.log(
            "Remote:",
            req.socket.remoteAddress
        );

        console.log(
            "Origin:",
            req.headers.origin
        );

        console.log(
            "User-Agent:",
            req.headers["user-agent"]
        );

        const room =
            new GameRoom(ws);

        console.log(
            "Created room:",
            room.hostId
        );
    }
);





/* ============================================================
 * START SERVER
 * ============================================================
 */




httpsServer.listen(
    PORT,
    () => {
        console.log(
            `Peer server listening on https://localhost:${PORT}`
        );
    }
);
