using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using SkillSystem;


namespace UnityEngine
{
    class Debug
    {
        public static void Log(string message)
        {
            Console.WriteLine(message);
        }
        public static void LogError(string message)
        {
            Console.WriteLine("error: " + message);
        }

    }    
}

namespace SkillSystem
{


    /// <summary>
    /// "Skill" is a generic interface that allows me to give all entities  "enemies and players" custom behavior loops or "skills" 
    /// skills have the ability via System.Reflection to automatically target and assign actions to any public event/delegate on the entity. 
    /// 
    ///  skill["behaviour"] = (entity) => { Debug.log("new skill called");}
    ///  
    /// this functionallity means i can create skill inside static arrays, and it will be assigned to the entity on creation. 
    /// when used in conjunction with stance its expecting an enum passed into the skill constructor. 
    /// 
    /// static Skill<IEntity>[] = new[]{
    ///     new(Stance.enumValue){
    ///         ["behaviour"] = (entity) => { Debug.log("new skill called");}
    ///     }, 
    /// }
    /// 
    /// skill also contain the have, onStart and onEnd events automatically setup 
    /// </summary>




    /*
        class Entity : IEntity {

            static Skill<IEntity>[] stanceList = new[]{
             new(Stance.enumValue){
                 ["behaviour"] = (entity) => { Debug.log("new skill called");}
               },  
                new(Stance.efekok) {
                    ["onStart"] = (e) => { }
                    ["behaviour"] = (entity) => { Debug.log("new alled"); }
                    ["onEnd"] = (e) => { }
                }, 
            }
            enum Stance {
            enumValue,
            efekok    
        }

            SkillSystem.Stance stance; 
            delegate void EventT(IEntity e){}
            event EventT behaviour; 
        }
    */












    public class Skill<T> where T : IEntity
    {
        public delegate void Event(T e);

        // inside a "SkillList/StanceList" stance is expecting enums i
        public Skill(Enum state) => this.state = (int)Convert.ChangeType(state, state.GetTypeCode());
        public Skill(int state = -1) => this.state = state;
        public Skill() => this.state = -1;

        internal int state;
        public delegate void SkillAction<E>(E type);
        // onsetup and complete adds/removes the skill to/from the foreign event its targeting.  
        SkillAction<T> onSetup, onComplete;
        // allows us to trigger things when we switch to and from a skill, call the same as you would any other skill
        public event Event onStart, onEnd;


        /// <summary>
        /// Event this[string s]
        /// allows us to referance "fields inside this object on setup" like the following Example 
        /// 
        /// new Skill<IEntity>.Skill(){
        ///     ["behaviour"] = (entity) => { Debug.log("new skill called from " + entity.Name);}
        /// }
        /// <returns>

        public Event this[string eventName]
        {
            set
            {
                var name = typeof(T).Name;
                eventName = eventName.Trim(); 
                // gets the events on 
                EventInfo eventInfo = typeof(T).GetEvent(eventName);

                var events = typeof(T).GetEvents(); // Only public events

                Debug.Log($"setting up {eventName} for {name} ");
                foreach (var ev in events)
                {
                    Debug.Log($"Event: {ev.Name}, Handler Type: {ev.EventHandlerType}");
                }


                // 
                if (eventInfo != null)
                {  // if it found the event on its caller type
                    onSetup += (e) => { try { eventInfo.AddEventHandler(e, value); } catch { Debug.LogError($"{eventName} is not a event for {name}"); } };
                    onComplete += (e) => { try { eventInfo.RemoveEventHandler(e, value); } catch { Debug.LogError($"{name} failed to remove event: {eventInfo.Name} {value}"); } };
                }
                else
                {
                    // if it couldn't find the event we check if its an internal event. ie (Skill.onStart, Skill.onEnd)
                    switch (eventName)
                    {
                        case "onStart":
                            SetupLocalEvent("onStart");
                            break;
                        case "onEnd":
                            SetupLocalEvent("onEnd");
                            break;
                        default:
                            Debug.LogError(name + " failed to setup skill event: " + eventName + " was not found");
                            return;
                    }
                    void SetupLocalEvent(string eventName)
                    {
                        eventInfo = (typeof(Skill<>).MakeGenericType(typeof(T))).GetEvent(eventName, BindingFlags.Instance | BindingFlags.Public);
                        onSetup += e => eventInfo.AddEventHandler(this, value);
                        onComplete += e => eventInfo.RemoveEventHandler(this, value);
                    }
                }
            }
        }

        // called externally from "Stance.cs" adds this skill to the foreign event its targeting 
        internal void Setup(IEntity entity)
        {
            onSetup?.Invoke((T)entity);
            // invokes all startup scripts before the new event starts its first itteration. 
            onStart?.Invoke((T)entity);
        }
        // called externally from "Stance.cs" removes this skill to the foreign event its targeting 
        internal void Cancel(IEntity entity)
        {
            // invokes all onEnd scripts before the new event its switching to starts.
            onEnd?.Invoke((T)entity);
            onComplete?.Invoke((T)entity);
        }
    }
}


