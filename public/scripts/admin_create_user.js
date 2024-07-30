const box = document.getElementById("box");
let allBindings = {};

async function getData() {
  try {
    const response = await fetch("/get-id-bindings");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const idBindings = await response.json();
    console.log("ID Bindings:", idBindings);
    allBindings = idBindings;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

document.addEventListener("DOMContentLoaded", getData);

const defaultBox = box.innerHTML;

document.querySelector("#showRoleIdList").addEventListener("click", (event) => {
  event.preventDefault();
  if (allBindings.roleIds && allBindings.roleIds.length > 0) {
    box.innerHTML = defaultBox;
    allBindings.roleIds.forEach((role) => {
      box.innerHTML += `<div>${role.Access_Type_ID}: ${role.Access_Type_Name}</div>`;
    });
    box.style.display = "block";
  } else {
    box.innerHTML = defaultBox + "No role IDs available.";
  }
});

document.querySelector("#showTestIdList").addEventListener("click", (event) => {
  event.preventDefault();
  if (allBindings.testTypes && allBindings.testTypes.length > 0) {
    box.innerHTML = defaultBox;
    allBindings.testTypes.forEach((test) => {
      box.innerHTML += `<div>${test.Test_Type_ID}: ${test.Test_Type_Name}</div>`;
    });
    box.style.display = "block";
  } else {
    box.innerHTML = defaultBox + "No test type IDs available.";
  }
});