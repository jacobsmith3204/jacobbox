self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));


let p2pPort = null;
const pendingResponses = {};

self.addEventListener("message", (event) => {
    if (event.data.type === "setPort") {
        p2pPort = event.data.port;


        p2pPort.onmessage = (ev) => {
            const res = JSON.parse(ev.data);


            if (pendingResponses[res.id]) {
                pendingResponses[res.id](res);
                delete pendingResponses[res.id];
            } else {
                console.warn("SW: no pending response for id", res.id);
            }
        };
        
        // sends a first init message back, so we know its working
        p2pPort.postMessage(JSON.stringify({
            id: "init",
            ok: true,
            message: "P2P port connected"
        }));
    }
});

self.addEventListener("fetch", (event) => {


    const url = new URL(event.request.url);
    const index = url.pathname.indexOf("/p2p/")
    if (index == -1)
        return;
    const pathname = url.pathname.slice(index + 4);
    event.respondWith(handleP2P(pathname));
});

function handleP2P(path) {
    return new Promise((resolve) => {
        if (!p2pPort) {
            resolve(new Response("P2P not ready", { status: 503 }));
            return;
        }

        const id = Math.random().toString(36).slice(2);

        pendingResponses[id] = (res) => {
            if (!res.ok) {
                resolve(new Response("Not found", { status: 404 }));
                return;
            }

            const body = Uint8Array.from(atob(res.body), c => c.charCodeAt(0));

            resolve(new Response(body, {
                headers: { "Content-Type": res.mime }
            }));
        };

        p2pPort.postMessage(JSON.stringify({ id, path }));
    });
}