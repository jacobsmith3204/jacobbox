
using SkillSystem;
using UnityEngine;

class DemoEntity : IEntity
{
    public DemoEntity()
    {
        stance = new SkillSystem.Stance(this, "Stance", "skillList");
    }

    public enum Stance
    {
        log,
    }

    public static Skill<DemoEntity>[] skillList = new Skill<DemoEntity>[] {
        new Skill<DemoEntity>(Stance.log) {
            ["behaviour"] = (e) => { Debug.Log("loging nane" + e.GetType().FullName ); }
        }
    };



    public SkillSystem.Stance stance;

    public delegate void DemoEvent(IEntity e); 
    public event DemoEvent behaviour;

    static void Main(string[] args)
    {
        Debug.Log("starting from main");
        new DemoEntity().Start(); 
        

    }

    void Start()
    {

        Debug.Log("starting demo entity");

        stance *= Stance.log; 
        //behaviour.Invoke(this); 
    }



}