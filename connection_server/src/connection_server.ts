
import https from "https";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import {
  WebSocketServer,
  WebSocket,
  RawData,
} from "ws";
import { IncomingMessage, ServerResponse } from "http";
import { lookup as lookupMimeType } from "mime-types";

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const PORT = 8000;
const MAX_MESSAGE_SIZE = 1024 * 1024;

interface PeerMessage {
  request?: string;
  answer?: unknown;
  offer?: unknown;
  candidate?: unknown;
  ice?: unknown;
  complete?: unknown;
  host?: string;
  id?: number;
  [key: string]: unknown;
}

function parseMessage(data: RawData): PeerMessage {
  const parsed: unknown = JSON.parse(data.toString());

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Message must be a JSON object");
  }

  return parsed as PeerMessage;
}

function sendJson(client: WebSocket, message: unknown): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

function sendError(client: WebSocket, error: string): void {
  sendJson(client, { error });
}

function generateClientId(): number {
  return crypto.randomInt(1, 2 ** 31 - 1);
}

class GameRoom {
  static readonly ROOMS = new Map<string, GameRoom>();

  readonly hostId: string;
  readonly client: WebSocket;

  readonly queueingClients = new Map<number, ActiveConnectionRequest>();

  private destroyed = false;

  private constructor(client: WebSocket, hostId: string) {
    this.client = client;
    this.hostId = hostId;

    GameRoom.ROOMS.set(hostId, this);

    console.log("Created host room:", hostId);

    client.on("message", (data) => {
      try {
        this.onMessage(data);
      } catch (error) {
        console.error("Host message error:", error);
      }
    });

    client.on("close", () => this.destroy());

    client.on("error", (error) => {
      console.error("Host WebSocket error:", error);
      this.destroy();
    });

    sendJson(client, {
      response: "started game",
      host: hostId,
    });
  }

  static createNew(client: WebSocket): GameRoom {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let hostId: string;

    do {
      hostId = "";

      for (let i = 0; i < 4; i++) {
        hostId += chars[crypto.randomInt(0, chars.length)];
      }
    } while (this.ROOMS.has(hostId));

    return new GameRoom(client, hostId);
  }

  static get(hostId: string): GameRoom | undefined {
    return this.ROOMS.get(hostId);
  }

  hasClient(clientId: number): boolean {
    return this.queueingClients.has(clientId);
  }

  private onMessage(data: RawData): void {
    const request = parseMessage(data);

    console.log("Host received:", request);

    if (request.complete !== undefined) {
      this.handleCompletion(request);
    } else if (request.offer !== undefined) {
      this.handleOffer(request);
    } else if (request.ice !== undefined) {
      this.handleIce(request);
    } else {
      console.warn("Unknown host message:", request);
    }
  }

  private getValidClient(
    request: PeerMessage,
  ): ActiveConnectionRequest | undefined {
    if (
      typeof request.id !== "number" ||
      !Number.isSafeInteger(request.id)
    ) {
      return undefined;
    }

    return this.queueingClients.get(request.id);
  }

  private handleOffer(request: PeerMessage): void {
    const user = this.getValidClient(request);

    if (!user) {
      console.warn("Invalid client for offer:", request.id);
      return;
    }

    user.push(request);
  }

  private handleIce(request: PeerMessage): void {
    const user = this.getValidClient(request);

    if (!user) return;

    user.push(request);
  }

  private handleCompletion(request: PeerMessage): void {
    const user = this.getValidClient(request);

    if (!user) return;

    this.queueingClients.delete(user.clientId!);

    console.log("Completed connection:", user.clientId);
  }

  sendToHost(message: unknown): void {
    sendJson(this.client, message);
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    if (GameRoom.ROOMS.get(this.hostId) === this) {
      GameRoom.ROOMS.delete(this.hostId);
    }

    for (const user of this.queueingClients.values()) {
      user.push({ error: "host disconnected" });
      user.destroy();
    }

    this.queueingClients.clear();

    console.log("Removing room:", this.hostId);
  }
}

class ActiveConnectionRequest {
  readonly client: WebSocket;

  room: GameRoom | null = null;
  clientId: number | null = null;
  hostId: string | null = null;

  private destroyed = false;

  constructor(client: WebSocket) {
    this.client = client;

    client.on("message", (data) => {
      try {
        this.onMessage(data);
      } catch (error) {
        console.error("Client error:", error);
        this.closeWithError("not a valid request, closing socket");
      }
    });

    client.on("close", () => this.destroy());

    client.on("error", (error) => {
      console.error("Client WebSocket error:", error);
      this.destroy();
    });

    sendJson(client, {
      response: "started client connection process",
    });
  }

  private onMessage(data: RawData): void {
    const request = parseMessage(data);

    if (this.room === null) {
      this.handleRequest(request);
      return;
    }

    if (request.answer !== undefined) {
      this.handleAnswer(request);
      return;
    }

    if (request.candidate !== undefined) {
      this.handleIce(request);
      return;
    }

    throw new Error("Needs a request, answer or candidate field");
  }

  private getValidRoomOrCloseSocket(
    request: PeerMessage,
  ): GameRoom | null {
    if (!request.host) {
      sendError(this.client, "no host code provided");
      this.destroy();
      return null;
    }

    const room = GameRoom.get(request.host);

    if (
      !room ||
      room.client.readyState === WebSocket.CLOSED ||
      room.client.readyState === WebSocket.CLOSING
    ) {
      sendError(this.client, `room does not exist ${request.host}`);
      this.destroy();
      return null;
    }

    return room;
  }

  private handleRequest(request: PeerMessage): void {
    const room = this.getValidRoomOrCloseSocket(request);

    if (!room) return;

    let clientId: number;

    do {
      clientId = generateClientId();
    } while (room.hasClient(clientId));

    this.clientId = clientId;
    this.room = room;
    this.hostId = room.hostId;

    room.queueingClients.set(clientId, this);

    request.id = clientId;
    request.host = room.hostId;

    room.sendToHost(request);

    console.log("Registered client:", clientId);
  }

  private handleAnswer(request: PeerMessage): void {
    if (!this.room || this.clientId === null) return;

    request.id = this.clientId;
    request.host = this.hostId!;

    this.room.sendToHost(request);
  }

  private handleIce(request: PeerMessage): void {
    if (!this.room || this.clientId === null) return;

    request.id = this.clientId;
    request.host = this.hostId!;

    this.room.sendToHost(request);
  }

  push(message: unknown): void {
    sendJson(this.client, message);
  }

  private closeWithError(error: string): void {
    sendError(this.client, error);
    this.client.close(1008, "Invalid request");
    this.destroy();
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    if (
      this.room &&
      this.clientId !== null &&
      this.room.queueingClients.get(this.clientId) === this
    ) {
      this.room.queueingClients.delete(this.clientId);
    }

    console.log("Client disconnected:", this.clientId);
  }
}

function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  let pathname: string;

  try {
    pathname = decodeURIComponent(
      new URL(req.url, "https://localhost").pathname,
    );
  } catch {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const filePath = path.resolve(PUBLIC_DIR, "." + pathname);

  if (
    filePath !== PUBLIC_DIR &&
    !filePath.startsWith(PUBLIC_DIR + path.sep)
  ) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      lookupMimeType(filePath) || "application/octet-stream",
    );

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      console.error(error);

      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal server error");
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  });
}

const httpsServer = https.createServer(
  {
    key: fs.readFileSync("./certs/server.key"),
    cert: fs.readFileSync("./certs/server.cert"),
  },
  (req, res) => {
    if (
      req.url === "/peer_server" ||
      req.url === "/peer_client"
    ) {
      res.statusCode = 426;
      res.setHeader("Upgrade", "websocket");
      res.end("WebSocket upgrade required");
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStaticFile(req, res);
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  },
);

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_MESSAGE_SIZE,
});

httpsServer.on("upgrade", (req, socket, head) => {
  if (
    req.url !== "/peer_server" &&
    req.url !== "/peer_client"
  ) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on(
  "connection",
  (ws: WebSocket, req: IncomingMessage) => {
    if (req.url === "/peer_server") {
      console.log("Host connected");
      GameRoom.createNew(ws);
      return;
    }

    if (req.url === "/peer_client") {
      console.log("Client connected");
      new ActiveConnectionRequest(ws);
      return;
    }

    ws.close(1008, "Invalid endpoint");
  },
);

httpsServer.listen(PORT, () => {
  console.log(`HTTPS server listening on port ${PORT}`);
  console.log(`Host: wss://localhost:${PORT}/peer_server`);
  console.log(`Client: wss://localhost:${PORT}/peer_client`);
});
