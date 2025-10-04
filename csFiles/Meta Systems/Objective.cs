using System.Collections.Generic;
using System;
using UnityEngine;


/// <summary>
///   requires "StatTracker.cs"
///  interface "Objective" has all the basic stuff you'd need to manage one of these objectives
///  "class Objective<T>" defines a type spesific objective which uses a "statTracker" field to be able to subscribe to its target variable. 
///  when its StatTracker target variable is updated we can check whether or not the objective meets its completion criteria 
/// </summary>

public partial interface Objective {
    // static utilities to manage all objectives
    static List<Objective> currentObjectives = new List<Objective>();
    static void Add(Objective objective) => currentObjectives.Add(objective);
    static void Remove(Objective objective) => currentObjectives.Remove(objective);
    static void ClearAll() {
        foreach (Objective o in currentObjectives)
            o.Cancel();
    }

    // level objective interface
    string name { get; set; }
    string description { get; set; }

    public delegate void Handler();
    event Handler onComplete;
    event Handler onFinish;
    event Handler onFail;

    void Complete();
    void Fail();
    void Cancel();
    bool MeetsCriteria();
}


public class Objective<T> : Objective {
    public Objective() { }
    public Objective(StatTracker<T> tracker) {
        tracker.subscribe += SubscriptionEvent;
        onFinish += UnsubscribeTracker;
        startingValue = tracker.value;
        this.tracker = tracker;
    }

    //stuff to implement  Objective interface
    public string name { get; set; }
    public string description { get; set; }

    public event Objective.Handler onComplete;
    public event Objective.Handler onFinish;
    public event Objective.Handler onFail;

    // everything relevant for this to work
    StatTracker<T> tracker;
    public T startingValue;
    public Func<Objective<T>, bool> meetsObjectiveCriteria;

  
    // allows for outside queries into if this meets its criteria.
    //(use cases are probably limited as it should usually be false, and anything relevant to the objective final state should a function subscribed to the intended outcome)
    public bool MeetsCriteria() => meetsObjectiveCriteria(this);

    // whenever the statTrackers value is written to this subscription event is called
    void SubscriptionEvent(StatTracker<T> objective) {
        // we evaluate if it meets our criteria (something that we can (re)assign when creating editing the objective)
        if (MeetsCriteria())
            Complete();
    }
    // removes this objectives current subscription from the statTracker variable. 
    void UnsubscribeTracker() {
        if (tracker != null)
            tracker.subscribe -= SubscriptionEvent;
    }

    // "Complete" and "Fail" call their respective events before calling "Finish"
    
    public void Complete() {
        onComplete?.Invoke();
        Finish();
    }
    public void Fail() {
        onFail?.Invoke();
        Finish();
    }
    public void Cancel() => Finish();

    // intended to clean up the objective and all its related components regardless of the completion of the objective. 
    void Finish() => onFinish?.Invoke();
}
