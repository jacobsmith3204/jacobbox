using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using SkillSystem;

namespace SkillSystem {


    // stance allows us to easily switch between different skills using the format
    // entity.stance *= EntityStanceEnum.newStance;
    // entity.stance *= entity.lastStance; // (last stance being an int)



    public class Stance {
        #region constructor/creation of the stance 

        public Stance(IEntity entity, string StanceEnumName, string skillListName ) {
            this.entity = entity;
            this.type = entity.GetType();
            //Debug.Log("adding entity " + entity.GetType() + "  " + type.Name);

            SetupGenericMethods();
            SetStanceList(skillListName);
            SetStanceNames(StanceEnumName);
            CheckForStanceListIndexMissMatch.Invoke(this, null);
        }

        IEntity entity;
        Type type;

        #region Working With Generic Methods
        // method info 
        MethodInfo GetCurrentSkill;
        MethodInfo GetSkill;
        MethodInfo SetupCurrentSkill;
        MethodInfo SetupOnEnd;
        MethodInfo CancelSkill;
        MethodInfo CheckForStanceListIndexMissMatch;

        Skill<T> _GetCurrentSkill<T>() where T : IEntity => (Skill<T>)currentSkill;
        Skill<T>[] _GetSkillList<T>() where T : IEntity  => (Skill<T>[])stanceList;
        Skill<T> _GetSkill<T>(int i) where T : IEntity  => _GetSkillList<T>()[i];
        void _SetupCurrentSkill<T>() where T : IEntity  => _GetCurrentSkill<T>()?.Setup(entity);
        void _SetupOnEnd<T>(Skill<T>.Event e) where T : IEntity  => _GetCurrentSkill<T>().onEnd += e;
        void _CancelSkill<T>(object skill) where T : IEntity  => ((Skill<T>)skill).Cancel(entity);
        // validates stancelist is in the correct order
        void _CheckForStanceListIndexMissMatch<T>() where T : IEntity {
            //Debug.Log(typeof(T).Name + "  " + stanceList.GetType());
            var list = stanceList as Skill<T>[] ;
            for (int i = 0; i < list.Length; i++)
                if (i != list[i].state)
                    Debug.LogError(type.Name + " stanceList and Stance enum missmatch");
        }


        // uses the names of the methods above to allow the MethodInfo field above them to act as type bound versions where the type is the type of the entity we are acting on.
        void SetupGenericMethods() {
            GetSkill = SetupGenericMethod("_GetSkill");
            GetCurrentSkill = SetupGenericMethod("_GetCurrentSkill");
            SetupCurrentSkill = SetupGenericMethod("_SetupCurrentSkill");
            SetupOnEnd = SetupGenericMethod("_SetupOnEnd");
            CancelSkill = SetupGenericMethod("_CancelSkill");
            CheckForStanceListIndexMissMatch = SetupGenericMethod("_CheckForStanceListIndexMissMatch");
        }

       
        MethodInfo SetupGenericMethod(string name) => typeof(Stance).GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic).MakeGenericMethod(this.type);

        #endregion 
        
        object stanceList;
        string[] stanceNames; // allows us to get the named enums asociated with the states & allows us to throw an error when the enums and skills aren't in the same order
        static Type enumType;

        void SetStanceList(string skillListName) {
            // expects type(IEntity) to have a "Public Static List" of skills  
            FieldInfo fieldInfo = type.GetField(skillListName, BindingFlags.Public | BindingFlags.Static);
            if (fieldInfo != null)
               
                stanceList = fieldInfo.GetValue(null);  // null for static field
            else
                Debug.LogError("error, no 'skillList' in " + type.Name);
        }
        void SetStanceNames(string stanceEnumName) {
            // looks for a Public Enum with the name provided by "StanceName"
            enumType = type.GetNestedType(stanceEnumName, BindingFlags.Public);
            if (enumType != null && enumType.IsEnum) {
                // writes the enum keys to an array. 
                Array enumValues = Enum.GetValues(enumType);
                stanceNames = new string[enumValues.Length];
                for (int i = 0; i < enumValues.Length; i++)
                    stanceNames[i] = enumValues.GetValue(i).ToString();
            }
            else {
                Debug.LogError("couldn't find the Stance Enum on " + type.Name + " was looking for a public enum with name " + stanceEnumName);
            }
        }

        #endregion




        #region skill management 

        internal bool lockedStance = false;
        object currentSkill;
        internal int lastState = 0; // updated when we change currentState
        int _currentState = -1;

        internal int currentState {
            get => Math.Max(_currentState, 0);
            set => _currentState = value;
        }

        public int nextState {
            set {
                if (value != _currentState) {
                    if (lockedStance)
                        return;

                    CancelCurrentSkill();
                    //currentSkill = stanceList[currentState = value];
                    //currentSkill?.Setup(entity);


                    currentSkill = GetSkill.Invoke(this, new object[] { (currentState = value) });
                    SetupCurrentSkill.Invoke(this, null);

                }
            }
        }

        // allows us to inject a  custom skill when needed. 
        internal void SwitchToCustomSkill<T>(Skill<T> skill, Action onExit = null) where T : IEntity  {
            if (lockedStance)
                return;

            CancelCurrentSkill();

            if (skill != null) {
                currentSkill = skill;
                SetupCurrentSkill.Invoke(this, null);
                if (onExit != null)
                    SetupOnEnd.Invoke(this, new object[] { (Skill<T>.Event)(e => { onExit.Invoke(); }) });
            }
        }

        public void CancelCurrentSkill() {
            lastState = currentState;// allows us to revert to the last known state. when needed
            object lastSkill = GetCurrentSkill.Invoke(this, null);
            currentSkill = null; // need to remove the current skill first to avoid multiple onEnds 
            if (lastSkill != null)
                CancelSkill.Invoke(this, new object[] { lastSkill });
            _currentState = -1;
        }
        #endregion

        // writes the enum.name of the current states associated field. 
        internal string enumString() => enumString(currentState);
        internal string enumString(int value) => (value >= 0 && value < stanceNames?.Length) ? stanceNames[value] : value.ToString();




        // conversion tools to be able to cast things
        public static implicit operator string(Stance state) => state.enumString();
        public static implicit operator int(Stance state) => state.currentState;

        public override bool Equals(object obj) => base.Equals(obj);
        public override int GetHashCode() => base.GetHashCode();


        public static bool operator ==(Stance state1, Enum state2) => state1 == (int)(object)state2;
        public static bool operator !=(Stance state1, Enum state2) => state1 != (int)(object)state2;
        public static Stance operator *(Stance state, int value) { state.nextState = value; return state; }
        public static Stance operator *(Stance state, Enum value) { state.nextState = (int)(object)value; return state; }
    }
}