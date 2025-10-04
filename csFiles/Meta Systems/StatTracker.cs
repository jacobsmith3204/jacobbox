using System;
using System.Reflection;

/// <summary>
///  is used in tandom with "Objective.cs to create auto updating events"
/// trackable stats are added into the interface as one would with any static field with a {get; set;} pair eg: "static StatTracker<int> Var { get; set; }"
/// stat can then be used anywhere in code with "StatTracker.Var" eg: var foo = StatTrack.Var.ToString();  or StatTrack.Var++;  
/// all stats are then initialised at runtime with "StatTracker.Initialise();"
/// 
/// StatTracker<T> contains a few operators to help with assigning values, etc. 
/// - implicit cast to T, so we van use StatTrack.Var as an int or other type without explisit (int)StatTrack.Var or requiring access to the value field via "StatTrack.Var.value"
/// - can't override = opperator so im using  *= to assign directly to the stat track value
/// - and i've manually added type support for += for int and float 
/// </summary>


public interface StatTracker
{
    // a "list" of all the stat tracker elements
    // these are static as to be able to use the interface to call "StatTracker.Day" to be able to get and set each of the variables without a referance to a greater system

    static StatTracker<int> Day { get; set; } = 0; // testing to see if i can do this instead of needing to call the initalise field 
    static StatTracker<int> DamageTaken { get; set; }
    static StatTracker<int> HeathItemsUsed { get; set; }
    static StatTracker<int> EliminatedEnemys { get; set; }
    static StatTracker<int> Dashs { get; set; }
    static StatTracker<int> CritDashs { get; set; }
    static StatTracker<int> Respawns { get; set; }
    static StatTracker<float> DistanceTraveled { get; set; }
    static StatTracker<int> WallHits { get; set; }
    static StatTracker<int> CritDashKills { get; set; }
    static StatTracker<int> ShieldEnemiesKilled { get; set; }

    // initialisation uses reflection to pull all the listed fields above and creates an instance of them as the {get;set;} doesn't do it itself 
    static void Initialise() { 
        FieldInfo[] fields = typeof(StatTracker).GetFields(BindingFlags.Static | BindingFlags.NonPublic);
        foreach (FieldInfo field in fields) {
            Type t = typeof(StatTracker<>).MakeGenericType(field.FieldType.GetGenericArguments());
            object newCustomField = Activator.CreateInstance(t);
            field.SetValue(null, newCustomField);
        }
    }
}

public class StatTracker<T> 
{
    // creates an event handler that other things such as the aformentioned Objective.cs file can subscribe to in order to do get updated whenever this component is written to. 
    // being able to subscribe to this lets 
    public delegate void Handler(StatTracker<T> e);
    public event Handler subscribe;

    public StatTracker() { }
    public StatTracker(T value) => _value = value; 

    private T _value;
    public T value
    {
        get => _value;
        set {
            _value = value;
            subscribe?.Invoke(this);
        }
    }


    // allows an implicit cast to the type T
    public static implicit operator T(StatTracker<T> obj) => obj._value;

    // allows me to set the value using an *= 
    public static StatTracker<T> operator *(StatTracker<T> objective, T value)
    {
        objective.value = value;
        return objective;
    }
    // type spesific operators// allows me to do += for int and float 
    public static StatTracker<T> operator +(StatTracker<T> objective, int value)
    {
        (objective as StatTracker<int>).value += value;
        return objective;
    }
    public static StatTracker<T> operator +(StatTracker<T> objective, float value)
    {
        (objective as StatTracker<float>).value += value;
        return objective;
    }
    public override string ToString() => value.ToString();
}