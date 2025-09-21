document.getElementById('gameCodeForm').addEventListener('submit', function (e) {
  e.preventDefault(); // Prevent form submission

  const codeInput = document.getElementById('gameCodeInput');
  const message = document.getElementById('message');
  const gameCode = codeInput.value.trim();

  // Simple validation
  if (gameCode === '') {
    message.textContent = 'Please enter a game code.';
    message.style.color = 'red';
    return;
  }

  // Optional: check if code matches a pattern (e.g., 4 alphanumeric characters)
  const codePattern = /^[A-Za-z0-9]{4,10}$/;
  if (!codePattern.test(gameCode)) {
    message.textContent = 'Invalid code format. Use 6-10 letters/numbers.';
    message.style.color = 'red';
    return;
  }

  // If valid
  message.textContent = `Game code "${gameCode}" submitted successfully!`;
  message.style.color = 'green';

  // You can now send this code to a backend server if needed.
});