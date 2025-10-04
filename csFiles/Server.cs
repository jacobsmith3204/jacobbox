using System;
using System.IO;
using System.Runtime;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

using UnityEngine;


public class Server
{
    static X509Certificate2 cert = null;
    static HttpServer server = new HttpServer();
    public static string ipAddress = "127.0.0.1";
    public static int port = 80;
    public Server()
    {
        currentDirectory = Application.dataPath + "/RemotePlayTestingSystem";

        //ipAddress = Dns.GetHostAddresses(Dns.GetHostName())[1].ToString();
        Debug.Log(ipAddress);
        Debug.Log(currentDirectory);

        server.createContext("/websocket", new WebSocketHandler());
        server.createContext("/index.html", new FileHandler());
        server.createContext("/javascript.js", new FileHandler());
        server.createContext("/gameConnection", new GameHandler());
        server.createContext("/BUILD/", new FileHandler());

        new SocketTcpHost(ipAddress); // creates the server that listens to socket hosted at the ip
    }


    public class SocketTcpHost
    {
        public IPAddress ipAddress;
        public Socket socket;
        List<Client> connectedClients = new List<Client>();
        public SocketTcpHost(string ip)
        {
            #region ssl attempt
            //cert = new X509Certificate2(currentDirectory + "/keys.cer", "password");
            //rsa.FromXmlString
            //.ImportFromEncryptedPem(File.ReadAllText(currentDirectory + /"keys.csr").ToCharArray(),"password".ToCharArray());
            //decryptedData = rsa.Encrypt(dataToEncrypt_bytes, RSAEncryptionPadding.OaepSHA1);

            //cert.PrivateKey = RSA.Create();
            //Debug.Log("creating listener " + IPAddress.Parse(ip) + ":" + port);
            //TcpListener listener = new TcpListener(IPAddress.Parse(ip), port);
            //listener.Start();

            //Task.Run(() =>
            //{
            //    try
            //    {
            //        while (true)
            //        {
            //            Debug.Log("Waiting for a client to connect...");
            //            TcpClient client = listener.AcceptTcpClient();
            //            ProcessClient(client);
            //        }
            //    }
            //    catch (Exception e) { Debug.LogError(e.Message + e.StackTrace); }
            //});


            static void ProcessClient(TcpClient client)
            {
                // A client has connected. Create the SslStream using the client's network stream.
                SslStream sslStream = new SslStream(client.GetStream(), false);
                // Authenticate the server but don't require the client to authenticate.
                try
                {
                    sslStream.AuthenticateAsServer(cert, false, System.Security.Authentication.SslProtocols.Default, true);
                    Debug.Log("authenticated");
                    //// Read a message from the client.
                    //string messageData = ReadMessage(sslStream);
                    ////// Write a message to the client.
                    //byte[] message = Encoding.UTF8.GetBytes("Hello from the server.<EOF>");
                    //Debug.Log("Sending hello message.");
                    //sslStream.Write(message);
                }
                catch (Exception e)
                {
                    Debug.LogError("Exception:" + e.Message + "\n" + e.StackTrace);
                    if (e.InnerException != null)
                        Debug.LogError("Inner exception: " + e.InnerException.Message + "\n" + e.StackTrace);
                    Debug.Log("Authentication failed - closing the connection.");
                    sslStream.Close();
                    client.Close();
                    return;
                }
                finally
                {
                    sslStream.Close();
                    client.Close();
                }
                string ReadMessage(SslStream sslStream)
                {
                    byte[] buffer = new byte[2048];
                    StringBuilder messageData = new StringBuilder();
                    int bytes = -1;
                    do
                    { // Read the client's test message.    
                        bytes = sslStream.Read(buffer, 0, buffer.Length);
                        // Use Decoder class to convert from bytes to UTF8 in case a character spans two buffers.
                        Decoder decoder = Encoding.UTF8.GetDecoder();
                        char[] chars = new char[decoder.GetCharCount(buffer, 0, bytes)];
                        decoder.GetChars(buffer, 0, bytes, chars, 0);
                        messageData.Append(chars);
                    } while (bytes != 0);
                    return messageData.ToString();
                }
            }

            #endregion
            #region http
            socket = new Socket(AddressFamily.Unspecified, SocketType.Stream, ProtocolType.Tcp);
            socket.Bind(new IPEndPoint(IPAddress.Parse(ip), port));
            socket.Listen(100);
            Task.Run(async () =>
            {
                while (true)
                {
                    Debug.Log("Waiting for a new connection...");
                    Socket clientSocket = new Socket(AddressFamily.Unspecified, SocketType.Stream, ProtocolType.Tcp);
                    new Client().socket = socket.Accept();
                    await Task.Yield();
                }
            });
            #endregion
        }


    }


    public class Client
    {
        public const int bufferSize = 1024;
        public byte[] buffer = new byte[bufferSize];
        public string message = "";
        public Socket socket;
        public SslStream stream;
        public bool encoded = false;

        public Client()
        {
            Debug.Log("client created");
            this.socket = new Socket(AddressFamily.Unspecified, SocketType.Stream, ProtocolType.Tcp);
            Client client = this; // to access within the task

            Task.Run(async () =>
            {
                while (!(socket.Connected && readBuffer())) // waits till its connected
                    await Task.Yield();
                Debug.Log("client Connected: " + message);
                HttpExchange exchange = new HttpExchange(message, client);

                Debug.Log(exchange.getRequestURI().Path);
                for (int i = 0; i < server.serverContexts.Count; i++)
                    if (exchange.getRequestURI().Path.Contains(server.serverContexts[i].context))
                    {
                        Debug.Log("getting context " + server.serverContexts[i].context + " from " + exchange.getRequestURI().Path);
                        server.serverContexts[i].handler.handle(exchange);
                        break;
                    }
            });
        }
        public bool readBuffer()
        { // returns true once its completed a message.
            List<byte> bytes = new List<byte>();
            int recieved = socket.Receive(buffer, bufferSize, SocketFlags.None);
            if (recieved > 0)
            {
                for (int i = 0; i < recieved; i++)
                    bytes.Add(buffer[i]);
                message = Server.DecodeMessage(bytes.ToArray(), encoded);
                bytes.Clear();
                return true;
            }
            return false;
        }

        public bool IsSsl()
        {
            return false;
        }
        public string ReadSslBuffer()
        {
            // Read the  message sent by the client.
            // The client signals the end of the message using the
            // "<EOF>" marker.
            byte[] buffer = new byte[2048];
            StringBuilder messageData = new StringBuilder();
            int bytes = -1;
            do
            {
                // Read the client's test message.
                bytes = stream.Read(buffer, 0, buffer.Length);

                // Use Decoder class to convert from bytes to UTF8
                // in case a character spans two buffers.
                Decoder decoder = Encoding.UTF8.GetDecoder();
                char[] chars = new char[decoder.GetCharCount(buffer, 0, bytes)];
                decoder.GetChars(buffer, 0, bytes, chars, 0);
                messageData.Append(chars);
                // Check for EOF or an empty message.
                if (messageData.ToString().IndexOf("<EOF>") != -1)
                {
                    break;
                }
            } while (bytes != 0);

            return messageData.ToString();
        }


        public void SendString(string str) => Send(Encoding.UTF8.GetBytes(str));

        public void Send(byte[] bytes)
        {
            if (encoded)
                SendEncoded(bytes);
            else
                socket.Send(bytes, SocketFlags.None);
        }

        void SendEncoded(byte[] buf)
        {
            Debug.Log("sending encoded bytes");

            List<byte> bytes = new List<byte>();
            int frameSize = 64;

            // splits it into "frames", each frame a byte aray 64 bytes long
            var q = buf.Select((b, i) => new { b, i });
            var w = q.GroupBy(x => x.i / (frameSize - 1));
            var e = w.Select(x => x.Select(y => y.b).ToArray());
            var parts = e.ToList();

            StringBuilder sb = new StringBuilder();

            var g = (new byte[] { 1, 2, 3 }).Select((b, i) => { return new { b, i }; }).GroupBy(x => { return 0; });
            //Debug.Log("finished g" + g.Count());

            for (int i = 0; i < parts.Count; i++)
            {
                byte cmd = 0;
                if (i == 0) cmd |= 1;
                if (i == parts.Count - 1) cmd |= 0x80;
                bytes.Add(cmd);
                bytes.Add((byte)parts[i].Length);
                bytes.AddRange(parts[i]);
            }

            socket.Send(bytes.ToArray(), SocketFlags.None);
        }

    }




    public class HttpServer
    {
        public List<HttpContext> serverContexts = new List<HttpContext>();
        public List<Client> clients = new List<Client>();

        public void createContext(String context, HttpHandler handler) => serverContexts.Add(new HttpContext(context, handler));
        public void createContext(String[] contexts, HttpHandler handler)
        {
            for (int i = 0; i < contexts.Length; i++)
                serverContexts.Add(new HttpContext(contexts[i], handler));
        }
    }

    public class HttpContext
    {
        public String context;
        public HttpHandler handler;

        public HttpContext(String context, HttpHandler handler)
        {
            this.context = context;
            this.handler = handler;
        }
    }

    // a base class that can be extended 
    public class HttpHandler
    {
        public virtual void handle(HttpExchange exchange)
        {
            Debug.Log("handle not implemented");
        }
    }

    public class FileHandler : HttpHandler
    {
        public override void handle(HttpExchange exchange)
        {
            Client client = exchange.client;
            string filePath = currentDirectory + exchange.getRequestURI().Path;
            byte[] file = new byte[0];
            try
            {
                Debug.Log("sending requested file " + filePath);
                file = File.ReadAllBytes(filePath);
            }
            catch
            {
                Debug.Log("failed to get requested file " + filePath);
                file = Encoding.Default.GetBytes("failed to get requested file");
                client.socket.Close();
            }

            try
            {
                ExchangeHeaders headers = new ExchangeHeaders();
                headers.Set(new String[] { "HTTP/1.1 200 OK", "Connection: close", "Content-Length: " + file.Length, ("Content-Type: " + ContentType(filePath)) });

                if (ContentEncoding(filePath) != "")
                    headers.Set(ContentEncoding(filePath));

                client.Send(addByteArrays(new byte[][] { headers.getBytes(), file }));
            }
            catch (Exception e)
            {

                Debug.LogException(e);

            }
             
           



            client.socket.Close();

        }
    }

    public class GameHandler : HttpHandler
    {
        public override void handle(HttpExchange exchange)
        {
            Client client = exchange.client;
            Task.Run(async () =>
            {
                Debug.Log("polling game instance");
                while (client.socket.Connected)
                {
                    if (client.readBuffer())
                        Debug.Log(client.message);
                    await Task.Yield();
                }
            });
        }
    }

    public class WebSocketHandler : HttpHandler
    {
        public override void handle(HttpExchange exchange)
        {
            Client client = exchange.client;
            client.encoded = AttemptWebsocketHandshake(client); // if the handshake is with a webserver we set our decode method to 
            Task.Run(async () =>
            {
                while (client.socket.Connected)
                {
                    if (client.readBuffer())
                        Debug.Log(client.message);
                    else
                        await Task.Yield();
                }
                Debug.Log("socket isnt connected");
            });
        }
        bool AttemptWebsocketHandshake(Client client)
        { // stolen from a website 
            Debug.Log("attempting websocket handshake");
            Debug.Log(new Regex("Sec-WebSocket-Key: (.*)").Match(client.message).Groups[1].Value);

            if (new Regex("^GET").IsMatch(client.message))
            {
                const string eol = "\r\n"; // HTTP/1.1 defines the sequence CR LF as the end-of-line marker
                byte[] response = Encoding.UTF8.GetBytes("HTTP/1.1 101 Switching Protocols" + eol
                    + "Connection: Upgrade" + eol
                    + "Upgrade: websocket" + eol
                    + "Sec-WebSocket-Accept: "
                    + Convert.ToBase64String(System.Security.Cryptography.SHA1.Create().ComputeHash(Encoding.UTF8.GetBytes(new Regex("Sec-WebSocket-Key: (.*)").Match(client.message).Groups[1].Value.Trim() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")))
                    + eol
                    + eol);
                client.socket.Send(response, response.Length, SocketFlags.None);
                return true;
            }
            return false;
        }
    }

    public static string DecodeMessage(byte[] bytes, bool encoded)
    {
        if (!encoded)
            return Encoding.Default.GetString(bytes);

        byte secondByte = bytes[1];
        int dataLength = secondByte & 127;
        int indexFirstMask = 2;
        if (dataLength == 126)
            indexFirstMask = 4;
        else if (dataLength == 127)
            indexFirstMask = 10;

        IEnumerable<byte> keys = bytes.Skip(indexFirstMask).Take(4);
        int indexFirstDataByte = indexFirstMask + 4;

        byte[] decoded = new byte[bytes.Length - indexFirstDataByte];
        for (int i = indexFirstDataByte, j = 0; i < bytes.Length; i++, j++)
            decoded[j] = (byte)(bytes[i] ^ keys.ElementAt(j % 4));

        return Encoding.UTF8.GetString(decoded, 0, decoded.Length);
    }







    // helpers for comunication for websites
    public class HttpExchange
    {
        public Client client;
        public string message;
        string[] requestHeaders;
        ExchangeHeaders responseHeaders = new ExchangeHeaders();
        public HttpExchange(string message, Client client)
        {
            this.client = client;
            this.message = message;
            requestHeaders = new Regex("\r\n").Split(message);// HTTP/1.1 defines the sequence CR LF as the end-of-line marker
        }

        public void setResponseHeaders(string headers) => responseHeaders.Set(headers);
        public void setResponseHeaders(string[] headers) => responseHeaders.Set(headers);
        public string getRequestMethod() => requestHeaders[0].Split(' ')[0];
        public UriBuilder getRequestURI()
        {
            UriBuilder b = new UriBuilder();
            b.Path = requestHeaders[0].Split(' ')[1];
            return b;
        }

        public string[] getRequestHeaders() => requestHeaders;
        public string getRequestHeader(string key)
        {
            for (int i = 0; i < requestHeaders.Length; i++)
            {
                string[] split = requestHeaders[i].Split(':');
                if (split[0].Trim() == key)
                    return split[1].Trim();
            }
            return "";
        }

        public string getRequestBody() => message.Substring(message.IndexOf("\r\n\r\n"));

        public string GetReferer()
        {
            for (int i = 0; i < requestHeaders.Length; i++)
                if ((requestHeaders[i].ToLower()).StartsWith("referer"))
                    return (requestHeaders[i].Split(':')[1]).Trim();
            return "NONE";
        }

        public string GetSenderIPAddress()
        { // works through ngrok
            for (int i = 0; i < requestHeaders.Length; i++)
                if ((requestHeaders[i].ToLower()).StartsWith("x-forwarded-for"))
                    return (requestHeaders[i].Split(':')[1]).Trim();
            return "NONE";
        }
    }
    public class ExchangeHeaders
    {
        string heading;
        public List<string> headers = new List<string>();
        public void Set(string str) => Set(new Regex("\r\n").Split(str));

        // splits it into pairs
        public void Set(string[] array)
        {
            for (int i = 0; i < array.Length; i++) // foreach key pair value split and check if it as found a match
            {
                string[] pair = array[i].Split(':');
                if (pair.Length > 1) // if its a key pair value then 
                {
                    int foundMatch = FindMatchingHeaderIndex(pair[0]); // check if it already exists and replace it if it doe
                    if (foundMatch >= 0)
                        headers[foundMatch] = array[i];
                    else // otherwise add the enw heading
                        headers.Add(array[i]);
                }
                else // if its not a key pair value then it must be our top header
                    heading = array[i];
            }
        }
        int FindMatchingHeaderIndex(string head)
        {
            int foundMatch = -1;
            head = head.Trim().ToLower();
            for (int i = 0; i < headers.Count(); i++)
                if (head == (headers[i].Split(':')[0]).Trim().ToLower())
                    foundMatch = i;
            return foundMatch;
        }
        public new string ToString()
        {
            string str = heading + "\r\n";
            for (int i = 0; i < headers.Count(); i++)
                str += headers[i] + "\r\n";
            return str + "\r\n";
        }
        public byte[] getBytes() => Encoding.Default.GetBytes(this.ToString());
    }

    public static string ContentEncoding(string path)
    {
        int index = path.LastIndexOf('.') + 1; // starts after the dot
        if (index > 0)
        {
            string fileEnding = path.Substring(index, path.Length - index);
            switch (fileEnding)
            {
                case "wasm":
                    return "Content-Encoding: application/wasm";
                case "br":
                    return "Content-Encoding: br";
                case "gz":
                    return "Content-Encoding: gzip";
                case "unityweb":
                    return "Content-Encoding: application/wasm";
            }
        }
        return "";
    }


    public static string ContentType(string path)
    {
        int index = path.LastIndexOf('.') + 1; // starts after the dot
        if (index > 0)
        {
            string fileEnding = path.Substring(index, path.Length - index);
            switch (fileEnding)
            {
                case "css":
                    return "text/css; charset= UTF-8";
                case "br":
                    return "application/wasm";
                case "gz":
                    return "application/wasm";
            }
        }
        return "text/html; charset= UTF-8";
    }

    public static string currentDirectory;
    public static string ReadFileAt(string path) => File.ReadAllText(path);
    public static byte[] addByteArrays(byte[][] arrays)
    {
        int totalLength = 0;
        for (int i = 0; i < arrays.Length; i++)
            totalLength += arrays[i].Length;
        byte[] finalBytes = new byte[totalLength];
        int curentcount = 0;
        for (int a = 0; a < arrays.Length; a++)
        {
            for (int i = 0; i < arrays[a].Length; i++)
                finalBytes[i + curentcount] = arrays[a][i];
            curentcount += arrays[a].Length;
        }
        return finalBytes;
    }
}
