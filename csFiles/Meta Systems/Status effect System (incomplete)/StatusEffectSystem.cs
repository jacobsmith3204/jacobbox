using System;
using System.Reflection;
using System.Collections.Generic;


class StatusEffectSystem
{




    static void Main(String[] args)
    {
        Debug.Log("[STARTING PROGRAM]");


        // simulating fight; 
        var pikachu = new Pikachu();
        var bulbasur = new Bulbasur();


        pikachu.Attack(bulbasur, "Headbutt");
        bulbasur.Attack(pikachu, Bulbasur.AttackType.Physical);
        bulbasur.Attack(bulbasur, Bulbasur.AttackType.Dodge);


        DoTurn();

    }
    static void DoTurn()
    {
        Debug.Log("\nStarting turn...");
        Debug.indent++;
        foreach (var entity in Entity.entities)
        {
            Debug.Log("invocationTest - [" + entity.name + "]:");
            Debug.indent++;
            for (int i = 0; i < entity.effects.Count; i++)
            {
                var effect = entity.effects[i];
                if ((bool)effect.InvocationTest())
                {
                    Debug.Log("invocation test fully resolved - removing from list");
                    entity.effects.RemoveAt(i--);
                }
            }
            Debug.indent--;
            Debug.Log("\n");
        }

        // sort queue
        foreach (var entity in Entity.entities){
            entity.queue.Sort((e,t) => (e.priority - t.priority));

        }

        foreach (var entity in Entity.entities)
        {
            Debug.Log("Fufulling QUEUE: [" + entity.name + "]");
            Debug.indent++;
            while (entity.queue.Count > 0)
            {
                var effect = entity.queue[0];
                entity.queue.RemoveAt(0);
                effect.Action();
            }
            Debug.indent--;
            Debug.Log("\n");
        }
        Debug.indent--;
    }






    abstract partial class Entity
    {
        internal string name => this.GetType().Name;
        int _hp = 10;
        internal int hp
        {
            get => _hp;
            set
            {
                if (value <= 0)
                    Kill();
                _hp = value;
            }
        }

        internal void Kill()
        {
            if (entities.Contains(this))
                entities.Remove(this);
        }


        public void Attack(Entity target, Enum attack) => Attack(target, attack.ToString());
        public void Attack(Entity target, string intendedAttack)
        {
            // pulls some things from this entities attached fields. 
            var type = this.GetType();
            var enumType = type.GetNestedType("AttackType");
            var attacksField = type.GetField("attacks", BindingFlags.Public | BindingFlags.Static);
            var attacks = (Func<Entity, StatusEffect>[])attacksField.GetValue(null);


            if (attacksField != null && enumType != null && enumType.IsEnum)
            {
                // parses the "intendedAttack" string into this entities class specific "AttackType" enum
                var attackType = Enum.Parse(enumType, intendedAttack);
                Debug.Log(name + " will be attacking " + target.name + " with type " + attackType.ToString());

                // creates an instance of the attack, finding the correct attack in the entities subclass, an adds the effect it to the target. 
                target.effects.Add(attacks[(int)attackType]?.Invoke(target));

            }
            else if (attacksField == null)
                Debug.Log("attacksField is Null for " + type.Name);
            else if (enumType == null)
                Debug.Log("failed to find Enum \"AttackType\" on " + target.name);
            else
                Debug.Log("\"AttackType\" wasn't an enum on " + target.name);
        }


    }




    // temp entity setup
    internal partial class Entity
    {
        internal Entity() => entities.Add(this);
        internal static List<Entity> entities = new ();

        // what its using to attack
        internal List<StatusEffect> outGoingEffects = new ();
        // what its been attacked with
        internal List<StatusEffect> effects = new ();
        // a working queue for the attack phase. 
        internal List<StatusEffect> queue = new ();
    }



    /* ! ================= !  ENTITIES  ! ====================  !*/
    class Pikachu : Entity
    {
        public enum AttackType
        {
            Headbutt,
            Lightning,
            Evade
        }
        public static Func<Entity, StatusEffect>[] attacks = new Func<Entity, StatusEffect>[]{
            (target)=> new Headbutt(target),
            /*(target)=> new GenericStatusEffect(target),
            (target)=> new GenericStatusEffect(target),*/
        };
    }


    class Bulbasur : Entity
    {
        public enum AttackType
        {
            Physical,
            Magical,
            Ranged, 
            Dodge,
        }

        public static Func<Entity, StatusEffect>[] attacks = new Func<Entity, StatusEffect>[]{
            (target)=> new GenericStatusEffect(target),
            (target)=> new GenericStatusEffect(target),
            (target)=> new GenericStatusEffect(target),
            (target)=> new Dodge(target)
        };

    }





















    /*effects*/


    internal abstract class StatusEffect
    {
        internal StatusEffect(Entity t) { target = t; }
        internal Entity target { get; set; } = null; 
        internal virtual EffectPriorityClass priority { get; }
        //internal List<StatusEffect> influences;
        internal abstract bool InvocationTest();
        internal abstract void Action();

        internal enum EffectPriorityClass
        {
            evade, 
            effect,
            physical, 


        }

    }





    
    internal class GenericStatusEffect : StatusEffect
    {
        internal GenericStatusEffect(Entity t):base(t){}
        internal override bool InvocationTest()
        {
            Debug.Log("[" + target.GetType().Name + "] is using the default invocation test");
            return true;
        }
        internal override void Action()
        {
            Debug.Log("invoking the default action");
        }
    }
    
    internal class Headbutt : StatusEffect
    {
        internal Headbutt(Entity t): base(t) {} 

        internal override EffectPriorityClass priority {get; } = EffectPriorityClass.physical;
        internal override bool InvocationTest()
        {
            Debug.Log("[" + target.GetType().Name + "] is using the headbutt invocation test");
            target.queue.Add(this);
            return true;
        }

        internal override void Action()
        {
            Debug.Log("invoking the headbutt action");
            target.hp -= 1;
            Debug.Log(target.name + " took 1 damage " + target.hp.ToString() + " remaining");
        }
    }
    internal class Dodge : StatusEffect {
        internal Dodge(Entity t ):base(t){}

        internal override bool InvocationTest(){
            Debug.Log("adding dodge");
            target.queue.Add(this);
            return true; 
        }
        internal override void Action(){
            
            Debug.Log("checking if " + target.name + " can dodge");

            for(int i = 0; i < target.queue.Count; i++)
            {
                Debug.Log("testing " + target.queue[i].GetType().Name); 
                if(target.queue[i].priority == EffectPriorityClass.physical)
                {
                    Debug.Log("removed");
                    target.queue.RemoveAt(i--);

                }
                

            }

        }

    }




    // GENERIC DEBUG
    class Debug
    {
        static internal int indent = 0;
        static internal void Log(string text)
        {
            string indentString = "";
            for (int i = 0; i < indent; i++)
                indentString += "| ";

            Console.WriteLine(indentString + text);
        }
    }
}


