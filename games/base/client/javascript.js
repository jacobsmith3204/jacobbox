class BaseClient {
    socket;

    z
    ConnectToServer() {
        this.socket = new WebSocket("/socket");
        this.socket.addEventListener('message', this.OnMessage.bind(this));
        this.socket.addEventListener('open', this.SendInitialisationMessage.bind(this));
    }

    SendInitialisationMessage(){
        // gets username and game id from local storage and sends it to the game client
        this.socket.send(JSON.stringify({ 
                type: "clientInitialisation", 
                message: { 
                    gameID: localStorage.getItem("gameID"), 
                    name: localStorage.getItem("username") }
                }));
    }

    OnMessage(event){
        console.log("on message not implemented",event.data); 
        



    }

}

