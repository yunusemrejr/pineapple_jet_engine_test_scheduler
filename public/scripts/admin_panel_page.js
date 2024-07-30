document.querySelector("#goBackButton").addEventListener("click", (event) => {
  window.location.href = "/main-selection-page";
});

document.querySelector("#shutdown-btn").addEventListener("click", (event) => {
  if (confirm("Are you sure you want to shutdown the server?") == true) {
    window.location.href = "/shutdown";
  }
});