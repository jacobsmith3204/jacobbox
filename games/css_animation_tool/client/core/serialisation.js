// static parse functions; 
Object.assign(AnimVal, {
    parse(obj) {
        return new AnimVal(obj.name, obj.syntax, obj.initialValue);
    }
});

// dymamic toString/toJson function
Object.assign(AnimVal.prototype, {
    toString() {
        return `@property --${this.name} {
                    syntax: '<${this.syntax}>';
                    inherits: true;
                    initial-value: ${this.initialValue}${this.extention}; 
                }`;
    }
});