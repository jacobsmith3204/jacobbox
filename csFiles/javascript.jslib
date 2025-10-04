mergeInto(LibraryManager.library, {

    DebugPush: function (str) { console.log(UTF8ToString(str)); },

    UpdateInfo: function (str) {
        var obj = JSON.parse(UTF8ToString(str));

        // info is a json object with a json array containing an json array of the grid positions around the player. 
        // info also will contain the player position, health, weapons and things like that. 
        // weapons are a json object with, an array of positions it can damage.
    },

    IsTurn: function (e) { },

    ConnectToServer: function (e) {
        socket = new WebSocket(`wss:/${location.hostname}/sockets`);
        //socket = new WebSocket(`wss:/${UTF8ToString(e)}`);
    },
    PushToServer: function (e) {
        var message = UTF8ToString(e);
        if (socket.readyState == 1)
            socket.send(message);
    },
    StartRecording: function () {
        var width = 32, height = 24;
        //`<video width="${width}" height="${height}">`;
        const video = document.createElement('video');
        video.setAttribute("width", width * 10);
        video.setAttribute("height", width * 10);
        document.body.appendChild(video);
        //video["width"] = 426;
        //video["height"] = 240;
        // request access to webcam
        navigator.mediaDevices.getUserMedia({ video: { width: width, height: height} }).then((stream) => video.srcObject = stream);

        // returns a frame encoded in base64
        const getFrame = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const data = canvas.toDataURL('image/png');
            return data;
        }
        var FPS = 1;
        var frameCount = 0;
        socket.onopen = () => {
            console.log(`video feed connected to websocket`);
            setInterval(() => {
                socket.send( JSON.stringify({"frame count": frameCount ++,"video data" : getFrame()}));
            }, 1000 / FPS);
        }
    }
});



/*

// when wanting to call a function you need to declear it like so.

using System.Runtime.InteropServices;

// *then inside class
    [DllImport("__Internal")]  private static extern void DebugPush(string str);
*/



