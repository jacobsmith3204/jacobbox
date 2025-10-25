using System;
using System.IO;
using System.Runtime;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using System.Net.Sockets;
using System.Net.Security;

class Test : myInterface
{
    // has a hidden Start method
    //void myInterface.Start() => this.Start(); 
}

interface myInterface
{
    void Start() {} // Console.WriteLine("default start?");
}

static class myClassExtentions
{
    public static void Start<T>(this T t) where T : myInterface
    {
        Console.WriteLine("starting test, via interface extention");
    }
}
 //error CS0535: 'Test' does not implement interface member 'myInterface.Start()'