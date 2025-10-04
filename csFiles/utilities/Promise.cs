using System;
using System.Collections.Generic;
using System.Collections.Specialized;

using UnityEngine;

public partial class Promise
{

    static List<Delay> promises = new List<Delay>();
    static  SortedList<float, Delay> scheduledPromises = new SortedList<float, Delay>();

    public static float timestep;
    public static float scaledTimestep => timestep * Time.timeScale;

    enum State
    {
        executing,
        resolved,
        canceled
    }

    State state = State.executing;
    Dictionary<string, object> outArgs;

    public Promise() { state = State.executing; }
    public Promise(Action<Action> p) => p?.Invoke(() => resolve());   // promises, when created will instantly invoke the action inside them, those actions use an action that can be invoked to resolve it to then finish the promise.
    public Promise(Func<bool> p)  => new Delay(p, () => resolve());  // delayed Promise, repeats function till "true" returned

    void resolve() => state = State.resolved;
    public void Resolve() {
        state = State.resolved;
    }

    public void then(Action<Promise> e) => promises.Add (new Delay(() => state != State.executing, () => { if (state == State.resolved) e?.Invoke(this); })); // allows us to read the out args of an item
    public void then(Action e) => promises.Add (new Delay(() => state != State.executing, () => { if (state == State.resolved) e?.Invoke(); }));  // simple action on exit


    public struct Delay {
        public Delay(Func<bool> condition) {
            // scheduled promises, complete their action each time they check the condition. so no need for the complete value
            this.condition = condition;
            this.complete = null;
            this.t = Time.timeSinceLevelLoad;
        }
        public Delay(Func<bool> condition, Action complete) {
            this.condition = condition;
            this.complete = complete;
            this.t = Time.timeSinceLevelLoad;  
        }
        public Func<bool> condition;
        public Action complete;
        public float t;
    }
}




public partial class Promise {

    public delegate void Event();
 
    public static Promise Wait(float delay) {
        var p = new Promise();
        AddScheduledPromise(delay, new Delay(() => true, p.resolve));
        return p;
    }
    public static Promise WaitUntil(Func<bool> condition) {
        var p = new Promise();
        var delay = new Delay(condition.Invoke, p.resolve);
        promises.Add(delay);
        return p;
    }

    public static Promise RepeatUntil( Func<bool> exit, Action whileRepeating) {
        var p = new Promise();
        var delay = new Delay(() => { if (exit.Invoke()) return true;  whileRepeating?.Invoke(); return false; }, p.resolve);
        promises.Add(delay);
        return p;
    }


    public static Promise ScheduleRepeatFixed(float initialDelay, Action<int> action, float interval, int repeat)
    {
        var p = new Promise();
        int i = 0;
        Delay delay = new Delay();
        delay = new Delay(() =>
        {
            // invokes the action, checks to see if it should exit, otherwise reschedules this delay
            action?.Invoke(i);
            if ((i++) >= repeat - 1)
                return true;
            UpdateScheduledPromise(interval, delay);
            return false;
        }, p.resolve);
        AddScheduledPromise(initialDelay, delay);
        return p;
    }

 
    static void AddScheduledPromise(float time, Delay delay) => scheduledPromises.Add( time + Time.timeSinceLevelLoad, delay);
    static void UpdateScheduledPromise(float interval, Delay delay) => scheduledPromises.Add(interval + Time.timeSinceLevelLoad, delay);
}



public partial class Promise {
    public static void FufillPromises()
    {
        for (int i = 0; i < promises.Count; i++)
            if (promises[i].t == Time.timeSinceLevelLoad) // makes sure we wait at least 1 frame. 
                continue;
            else if (promises[i].condition.Invoke())
            {
                Action a = promises[i].complete;
                promises.RemoveAt(i);
                a?.Invoke();
                i--;
            }


        // promises should be already ordered, should execute only up to the present time.
        for (int i = 0; i < scheduledPromises.Count; i++)
        {
            float time = (float)scheduledPromises.Keys[i];
            if (Time.timeSinceLevelLoad < time)
                break;
            else if (scheduledPromises.Values[i].condition.Invoke())
            {
                scheduledPromises.Values[i].complete?.Invoke();
                scheduledPromises.Remove(i);
            }
        }
    }

}