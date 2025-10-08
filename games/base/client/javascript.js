

var socket = new WebSocket("/socket"); 
socket.addEventListener('message', (event)=> console.log(event.data));
socket.addEventListener('open', ()=> {
    socket.send(JSON.stringify({type: "clientInitialisation", message: {gameID: "1234", name: "jacob"}}));
});