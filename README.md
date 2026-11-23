# jacobbox
jackbox clone for friends

# how it works

a websocket connection from the host's server to my server is established creating a "room" the clients can then join.  
 when the clients try connect to the "room" it then initates a RTCPeerConnection with the host, piggybacking only the initial communication through my server until a direct peer-to-peer connection is established.  
                
once the peer-to-peer connection is established, the page opens an iframe and requests for its content will direct to the host's server via the peer-to-peer connection. 
to do this im using a service worker to forward fetch requests for all the games "local" resources.  
to the content loaded within the iframe the peer-to-peer host appears to behave as if it was just a regular server to anything loaded from it. 
                
               


# using jacobbox
to use jacobbox you can run it standalone    (standalone server located at ```./connection_server```)    
```npm run host```  creates a server on localhost:8000 that will act as your middleman, you can expose this with ngrok or a service of your choice to make it accessable from other devices.  
```npm run demo:local ``` creates an instance of the game server, this points at the localhost:8000 server, establishes a connection and creates a room, check the console output for the room code.  
(this server will close when the websocket times out, if its not connecting make sure that the server is still active)    

you can also just skip the local server and just point it at my server  
```npm run demo:remote ``` 
this wcreates an instance of the game server but points it at my website, check the console for the room code.  
you can then access it by entering the code at https://jacobsmith3204.ngrok.io/jacobbox
# in order to develop a game for this only a couple files are required
if creating your own games
create a directory under ```./applications``` for your game.  inside your game directory add```src/``` for server stuff ```public/``` for everything it will load.
the way the project is structured i've included some .js & .ts files in ```./applications/common``` that you just need to extend in your own game.

## server
- ```p2p_host.ts``` provides a class that your own node typescript server can extend to provide functionality needed to talk to ```p2p_client.js``` hosted on the (local/remote)server

```
 // fetch it from
 import { P2PHost } from  "@common/src/p2p_host";
 
  
 // then extend it with 
 class [YOUR GAME NAME] extends P2PHost {
  constructor() {
    // passes the directory this file is located in so it knows where
    super(__dirname);
    
    // create a data channel by populating the datachannels object with a key 
    //(game_socket is just what i've called my default one) 
    
    P2PHost.dataChannels["game_socket"] = (dc) => {
      dc.onmessage = (event) => [YOUR FUNCTION TO HANDLE MESSAGES]
    };
  }
} 

// start the game by first creating an instance of your game class
cont game = new [YOUR GAME NAME]();


//HELPER FUNCTIONS TO ALLOW THE ADDRESS TO BE PASSED IN VIA ARGS
const args = process.argv.slice(2);
const backup_server_url = "wss://localhost:8000/peer_server";
const server_url = args[0] ?? backup_server_url; 

//starts the game pointing it at the correct server
game.start(server_url);
  


```
## client 
- ```clientMirror.js``` this allows you to talk to ```p2p_client.js``` from within the iframe your game will load inside. 

resources can't be shared directly from ```p2p_client.js```, since your games is not hosted on the same domain its considered an **insecure** connection so we use ```clientMirror.js``` to call functions from p2p_client.js outside the iframe, which will then return the result back through to the iframe.

the way the p2p_host.ts server is built ```./applications/common/public/[...clientMirror.js]``` will be fetched if it doesnt find anything at your ```[game]/public/``` location, so you can load it along side your game code from the html like so and it should just work. 
``` 
 <script src="clientMirror.js"></script> 
 <script src="yourGame.js"></script>
```

there is no other message protocol on top of the datachannel events so once the rtcPeerConnection is established its up to you how to start comunicating between the client and host to implement your game. 

if you need a hint for how to use anything the ```./applications/fizz_buzz/``` demo is a decent place to start as its pretty simple.   
