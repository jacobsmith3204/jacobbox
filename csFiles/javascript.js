function Start() {
   var url = "wss://" + location.host + "/websocket";
   SetupWebSocket(url);
   SetupWebcam();
}

var socket;
function SetupWebSocket(url) {
   socket = new WebSocket(url);
   socket.onopen = () => {
      socket.send("from webpage) hello world");
      console.log("websocket connected");
   };
}

function SendToServer() {
   if (socket.readyState == 1) {
      socket.send(document.getElementById("text").value);
   }
   else {
      console.log("socket not open");
   }
}

function SetupWebcam() {
   var but = document.getElementById("but");
   var video = document.getElementById("vid");
   var mediaDevices = navigator.mediaDevices;

   //vid.muted = true;
   but.addEventListener("click", () => {
      console.log("clicked on button");
      // Accessing the user camera and video.
      mediaDevices.getUserMedia({
            video: true,
            audio: true,
         }).then((stream) => {

            // Changing the source of video to current stream.
            video.srcObject = stream;
            video.addEventListener("loadedmetadata", () => {
               video.play();
            });
         })
         .catch(alert);
   });
}
