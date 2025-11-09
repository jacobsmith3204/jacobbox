

class AnimationBuilder {
    constructor(){
        this.LoadFromLocalStorage(); 
    }

    animTimelines = {};

    LoadFromLocalStorage() {
        // loads from localStorage; 
        if (localStorage.getItem("animVals")) {
            var obj = JSON.parse(localStorage.getItem("animVals"));
            // parse
            this.animTimelines = {};

            Object.values(obj).forEach(el => {
                this.animTimelines[el.name] = AnimVal.parse(el);
            });
        }
    }

    SaveToLocalStorage() {
        localStorage.setItem("animVals", JSON.stringify(animTimelines));
        localStorage.setItem("timeline", {});// the timeline/node positions and handles
    }


    GenerateCSS() {
        Object.values(animTimelines).forEach(val => {
            console.log(val.toString());
        });
    }
}





class AnimTimeline {
    animVal;   // = new AnimVal(); 
    keys; // = [new AnimKeyframes()]; 

    

}

class AnimVal {
    constructor(name, type, value) {
        this.name = name;
        this.syntax = type;
        this.initialValue = value;
    }

    static parse(obj) {
        return new AnimVal(obj.name, obj.syntax, obj.initialValue);
    }

    toString() {
        return `@property --${this.name} {
            syntax: '<${this.syntax}>';
            inherits: true;
            initial-value: ${this.initialValue}; 
        }`;
    }
}

class AnimKeyframes{ 
    handlePosLeft; // handles
    handlePosRight; // handles 
    handlesBound; // makes both handles aligned to the same point. 
    value; 
    time; 
}



var ab = new AnimationBuilder();
