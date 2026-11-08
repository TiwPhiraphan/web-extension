const timeElem = document.getElementById('time');
if (timeElem) {
  timeElem.textContent = new Date().toLocaleTimeString();
  setInterval(() => {
    timeElem.textContent = new Date().toLocaleTimeString();
  }, 1000);
}

