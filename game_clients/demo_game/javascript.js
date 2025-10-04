const form = document.getElementById("gameForm");
const message = document.getElementById("message");

form.addEventListener("submit", function (e) {
    e.preventDefault();

    
    const roomCode = location.hash;
    const playerName = document.getElementById("playerName").value.trim();

    if (playerName.length === 0) {
        message.textContent = "Please enter your name.";
        message.style.color = "red";
        return;
    }

    // Fake join action
    message.textContent = `🎉 Welcome, ${playerName}! Joining room ${roomCode}...`;
    message.style.color = "green";

    // TODO: Send data to server here
});