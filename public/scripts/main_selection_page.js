const welcomeText = document.querySelector("h1");
welcomeText.innerText = welcomeText.innerText.replace(";", "");

let usernameText = welcomeText.innerText.split(" ")[3];
const firstLetter = usernameText[0];
const newFirstLetter = firstLetter.toUpperCase();

usernameText = newFirstLetter + usernameText.slice(1);
welcomeText.innerText = welcomeText.innerText.replace(
  /(\b\w+\b\s){3}\b\w+\b/,
  (match) => {
    return match.split(" ").slice(0, 3).join(" ") + ", " + usernameText + ".";
  }
);