
// - an implementation of a finite state machine, with entry and exit functions called when switching state. 
export class StateSystem {
    entity;

    _currentState;
    set currentState(newState) {
        this._currentState = newState;
    }
    get currentState() {
        return this._currentState?.events
    }



    constructor(entity) {
        this.entity = entity;
    }

    set(newState) {
        //console.log(this, this.entity.constructor);
        if (!(newState == undefined || newState instanceof State || (newState = this.entity.constructor.STATES[newState]))) {
            console.error(`state ${newState} is not a valid state`);
            return;
        }
        // switches to the current state, exiting the old state first. 
        console.log("setting to state ", newState?.name);
        this._currentState?.onExit?.bind(this.entity)(); 
        newState?.onStart?.bind(this.entity)();
        this.currentState = newState;

    }
    call(targetEvent, ...params) {
        this.currentState[targetEvent]?.bind(this.entity)(...params);
    }
}
// organises the event params
export class State {
    constructor(name, { onStart, onExit, ...events }) {
        this.name = name; // helps when debugging
        this.onStart = onStart;
        this.onExit = onExit;
        this.events = events;
    }
}
export class StateList {
    // assigns the states as read-only values. 
    // these values can be accessed via their index or key
    // (this allows you to set state to [0] to return the first state as a default value)
    constructor(states) {
        Object.entries(states).map(([key, value], index) => {
            Object.defineProperty(this, key, {
                get() { return value },
            });
            Object.defineProperty(this, index, {
                get() { return value },
            });
        });
    }
}
