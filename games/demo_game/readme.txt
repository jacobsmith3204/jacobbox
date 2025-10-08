games will be structured as 

game -> 
    /client 
    /server

this way touching a game only alters 1 file path. 

base/client will have tools/an extendable class (similar to an api) that all subsequent clients can use to setup the websockets and other game communication.  