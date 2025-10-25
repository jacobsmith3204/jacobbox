using System;
using System.IO;
using System.Runtime;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using System.Net.Sockets;
using System.Net.Security;


using myTCPServer; 

public class Server
{
    //static X509Certificate2 cert = null;
    static TCPServer server;
    public static string ipAddress = "127.0.0.1";
    public static int port = 8000;

    static string projectDirectory = System.IO.Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
    static string currentDirectory = projectDirectory;


    public static async Task Main(string[] args)
    {
        Debug.Log("starts here");

       
        
        Debug.Log(ipAddress);
        Debug.Log(currentDirectory);

        server = new TCPServer();  // creates the server that listens to socket hosted at the ip

        server.createContext("/websocket", new WebSocketHandler());
        server.createContext("/index.html", new FileHandler());
        server.createContext("/javascript.js", new FileHandler());
        server.createContext("/gameConnection", new GameHandler());
        server.createContext("/BUILD/", new FileHandler());

        await server.Start(ipAddress, port);
        
        /*
        var textobj = new Test();
        textobj.Start(); 
        //*/

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
                headers.Set(new String[] { "HTTP/1.1 200 OK", "Connection: close", "Content-Length: " + file.Length, ("Content-Type: " + Helpers.ContentType(filePath)) });

                if (Helpers.ContentEncoding(filePath) != "")
                    headers.Set(Helpers.ContentEncoding(filePath));

                client.Send(Helpers.addByteArrays(new byte[][] { headers.getBytes(), file }));
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
}

class Debug
{
    public static void Log(string text)
    {
        Console.WriteLine(text);
    }
    public static void LogException(Exception exception)
    {
        Console.WriteLine(exception.Data);
    }
    public static void LogError(string text)
    {
        Console.WriteLine(text);
    }

}