const notifyWrapper=(message)=> {
  notify(message);
  };

/**
 * Variables to store global state.
 *
 * @type {Object}
 */
GLOBAL_PREDEFINED_LIMITS = null;
/**
 * Contains the resource usages that the user has added in the modal, but not yet submitted.
 * @type {Array<number>}
 */
GLOBAL_NEW_USAGES_FORM_DATA = null;

/**
 * Handler for when the user clicks outside of the modal to close it.
 */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("taskModal");
  // set the attribute to true initially
  modal.setAttribute("modal-hidden", "true");
  const closeBtn = document.getElementsByClassName("close")[0];
  /**
   * Event listener for when the user clicks on the modal or on the close button.
   * If the user clicks on the modal but not the close button, reload the page.
   * @param {Event} event - the event object
   */
  modal.addEventListener("click", (event) => {
    // check if the user clicked on the modal element itself or the close button
    if (event.target === modal || event.target === closeBtn) {
      // reload the page
      window.location.reload();
    }
  });
});

// Module for handling global variables and initialization
const Globals = (() => {
  async function initialize() {
    if (!GLOBAL_PREDEFINED_LIMITS || !GLOBAL_NEW_USAGES_FORM_DATA) {
      await fetchResources();
    }
  }

  return { initialize };
})();
// Define initializeGlobals function
async function initializeGlobals() {
  if (!GLOBAL_PREDEFINED_LIMITS || !GLOBAL_NEW_USAGES_FORM_DATA) {
    await fetchResources();
  }
}

/**
 * Event listener for when the DOM content is loaded.
 * Hides the edit and delete buttons on the page.
 */
document.addEventListener("DOMContentLoaded", () => {
  hideEditDeleteButtons();
  // Set a timeout to hide the edit and delete buttons after 1 second
  document.querySelector("#Show").addEventListener("click", () => {
    setTimeout(hideEditDeleteButtons, 1000);
  });
});

/**
 * Fetches predefined hourly limits from the server.
 * @returns {Promise<Array>} - A promise that resolves to an array of predefined hourly limits.
 */

function fetchPredefinedHourlyLimits() {
  return fetch("/get-predefined-hourly-limits")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Fetched predefined hourly limits data:", data);
      return data;
    })
    .catch((error) => {
      console.error("There was a problem with the fetch operation:", error);
    });
}

/**
 * Hides the bindings container element.
 */
function hideBindings() {
  document.querySelector("#id-bindings-container").style.display = "none";
}

/**
 * Event listener for the goBackButton click event.
 * Redirects the user to the main selection page.
 */
document.querySelector("#goBackButton").addEventListener("click", () => {
  window.location.href = "/main-selection-page";
});

/**
 * Updates the options of the selectDay element based on the provided month and year.
 * @param {HTMLSelectElement} selectDay - The select element to update.
 * @param {number} month - The month value.
 * @param {number} year - The year value.
 */
function updateDays(selectDay, month, year) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  selectDay.innerHTML = "";
  for (let i = 1; i <= daysInMonth; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.text = i;
    selectDay.appendChild(option);
  }
}

/**
 * Fetches tasks for the specified day from the server.
 * @param {string} dayValue - The day value.
 * @param {string} monthValue - The month value.
 * @param {string} yearValue - The year value.
 */
async function fetchTasks(dayValue, monthValue, yearValue) {
  try {
    const response = await fetch("/get-tasks-for-day", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        day: dayValue,
        month: monthValue,
        year: yearValue,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const tasks = await response.json();
    console.log(tasks); // Log the response for debugging
    const tasksContainer = document.getElementById("tasks-container");
    tasksContainer.innerHTML = "";

    if (tasks.length === 0) {
      tasksContainer.innerHTML = "<p>No tasks found for the selected day.</p>";
    } else {
      tasks.forEach((task) => {
        const taskElement = createTaskElement(task);
        tasksContainer.appendChild(taskElement);
      });
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}





function createTaskElement(task) {
  const taskElement = document.createElement("div");
  taskElement.classList.add("task");
  taskElement.innerHTML = `
        <p><strong>Status ID:</strong> ${task.Status_ID}</p>
        <p><strong>Test Type:</strong> ${task.Test_Type_Name}</p>
        <p><strong>Date:</strong> ${task.Date}</p>
        <p><strong>Hour:</strong> ${task.Hour}</p>
        <p><strong>User:</strong> ${task.Username}</p>
        <button class="view-resource-usage-button" onclick="viewResourceUsageOfTask(${task.Status_ID})">Res. Usage</button>
        <button class="view-resource-limits-button" onclick="viewResourceLimitsOfTask(${task.Status_ID})">Res. Limits</button>
        <button class="editbtn" onclick="editTask(event, ${task.Status_ID}, ${task.Test_Type_ID}, '${task.Date}', ${task.Hour}, ${task.User_ID})">Edit</button>
        <button class="deletebtn" onclick="deleteTask(${task.Status_ID})">Delete</button>
    `;
  return taskElement;
}

document.addEventListener("DOMContentLoaded", () => {
  const day = document.getElementById("day");
  const month = document.getElementById("month");
  const year = document.getElementById("year");

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  day.value = currentDay;
  month.value = currentMonth;
  year.value = currentYear;

  updateDays(day, currentMonth, currentYear);

  month.addEventListener("change", () => {
    updateDays(day, parseInt(month.value), parseInt(year.value));
  });

  year.addEventListener("change", () => {
    updateDays(day, parseInt(month.value), parseInt(year.value));
  });

  fetchTasks(currentDay, currentMonth, currentYear);

  document.getElementById("Show").addEventListener("click", () => {
    const dayValue = day.value;
    const monthValue = month.value;
    const yearValue = year.value;
    fetchTasks(dayValue, monthValue, yearValue);
  });

  document.getElementById("addNewTest").addEventListener("click", () => {
    openModal();
    activateEditModeBlockade(false);
    setTimeout(dateRangeModeForAdd, 100);
  });

  let bindings = [];

  async function onlyFetchIdBindings() {
    try {
      const idBindings = await fetchIdBindings();
      console.log("ID Bindings:", idBindings);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }

  onlyFetchIdBindings();

  async function fetchAndDisplayIdBindings() {
    try {
      const idBindings = await fetchIdBindings();
      console.log("ID Bindings:", idBindings);

      displayTestTypeBindings(idBindings.testTypes);
      displayUserBindings(idBindings.users);
      displayResourceTypeBindings(idBindings.resourceTypes);
      //displayResourceLimitsBindings(idBindings.resourceLimits);

      document.getElementById("id-bindings-container").style.display = "block";
    } catch (error) {
      console.error("Fetch ID bindings error:", error);
    }
  }

  document
    .getElementById("showIdBindings")
    .addEventListener("click", fetchAndDisplayIdBindings);
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("showIdBindings").click();
  });

  const modal = document.getElementById("taskModal");
  const span = document.getElementsByClassName("close")[0];

  span.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };



/**
 * Check if new resource usage exceeds predefined limits.
 * @param {Array} resourceLimits - Array of resource limits.
 * @param {Array} resourceUsages - Array of current resource usages.
 * @param {Array} newResourceUsages - Array of new resource usages.
 * @returns {boolean} - True if any limit is exceeded, otherwise false.
 */
function checkResourceUsageExceedsLimits(resourceLimits, resourceUsages, newResourceUsages) {
  console.log("Resource Limits:", resourceLimits);
  console.log("Resource Usages:", resourceUsages);
  console.log("New Resource Usages:", newResourceUsages);

  const combinedUsages = [...resourceUsages];

  newResourceUsages.forEach((newUsage) => {
    const existingUsage = combinedUsages.find(
      (usage) => usage.Resource_Type_ID === newUsage.Resource_Type_ID
    );
    if (existingUsage) {
      existingUsage.Resource_Used += newUsage.Resource_Used;
    } else {
      combinedUsages.push(newUsage);
    }
  });

  const exceededResources = combinedUsages.filter((usage) => {
    const limit = resourceLimits.find(
      (limit) => limit.Resource_Type_ID === usage.Resource_Type_ID
    );
    return limit && usage.Resource_Used > limit.Resource_Limit;
  });

  if (exceededResources.length > 0) {
    console.log("Exceeded Resources:", exceededResources);
    notifyWrapper(
      `Resource usage exceeds limits for the following resources:\n${exceededResources
        .map(
          (res) =>
            `Resource ID: ${res.Resource_Type_ID}, Usage: ${res.Resource_Used}, Limit: ${resourceLimits.find(
              (limit) => limit.Resource_Type_ID === res.Resource_Type_ID
            ).Resource_Limit}`
        )
        .join("\n")}`
    );
    return true;
  }
  return false;
}

// Event listener for form submission
// Event listener for form submission
document.getElementById("taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await initializeGlobals();

  console.log("Global Limits:", GLOBAL_PREDEFINED_LIMITS);
  console.log("Global Usages:", GLOBAL_NEW_USAGES_FORM_DATA);

  const taskId = document.getElementById("taskId").value;
  const testTypeId = document.getElementById("testTypeId").value;
  const taskDate = document.getElementById("taskDate").value;
  const taskHour = parseInt(document.getElementById("taskHour").value, 10);
  const userId = parseInt(document.getElementById("userId").innerText, 10);

  if (isNaN(taskHour) || taskHour > 24 || taskHour < 0) {
    notifyWrapper("Task hour must be a valid hour");
    return;
  }

  if (!pastHourChecker(taskDate, taskHour)) {
    return;
  }

  

 
 

  const newUsages = Array.from(document.querySelectorAll(".resource-usage")).map((select) => ({
    Resource_Type_ID: parseInt(select.getAttribute("data-resource-type-id")),
    Resource_Used: parseInt(select.value, 10),
  }));

  console.log("New Usages before check:", newUsages);

  if (checkResourceUsageExceedsLimits(GLOBAL_PREDEFINED_LIMITS, GLOBAL_NEW_USAGES_FORM_DATA, newUsages)) {
    console.log("Limits exceeded, preventing form submission.");
    return;
  }

  const requestBody = {
    testTypeId: parseInt(testTypeId),
    date: taskDate,
    hour: taskHour,
    userId,
    resourceLimitIds: Array.from(document.querySelectorAll(".resource-limit")).map((select) =>
      parseInt(select.value, 10)
    ),
    resourceUsageIds: newUsages.map((usage) => usage.Resource_Used),
  };

  try {
    let response;
    if (taskId) {
      response = await fetch(`/edit-task/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } else {
      response = await fetch("/add-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    notifyWrapper(taskId ? "Task updated successfully" : "Task added successfully");
    document.getElementById("taskModal").style.display = "none";

    
    const day = document.getElementById("day").value;
    const month = document.getElementById("month").value;
    const year = document.getElementById("year").value;
    fetchTasks(day, month, year);
  } catch (error) {
    console.error("Submit error:", error);
    notifyWrapper("Failed to submit task");
  }
});



  async function fetchIdBindings() {
    const response = await fetch("/get-id-bindings");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  }

  function displayTestTypeBindings(testTypes) {
    const testTypeBindings = document.getElementById("test-type-bindings");
    testTypeBindings.innerHTML = "<h4>Test Types</h4>";
    if (testTypes) {
      testTypes.forEach((binding) => {
        testTypeBindings.innerHTML += `<p>${binding.Test_Type_Name} is ID ${binding.Test_Type_ID}</p>`;
        bindings.push(binding.Test_Type_Name, binding.Test_Type_ID);
      });
    } else {
      testTypeBindings.innerHTML += "<p>No test types found</p>";
    }
  }

  function displayUserBindings(users) {
    const userBindings = document.getElementById("user-bindings");
    userBindings.innerHTML = "<h4>Users</h4>";
    if (users) {
      users.forEach((binding) => {
        userBindings.innerHTML += `<p>${binding.Username} is ID ${binding.User_ID}</p>`;
      });
    } else {
      userBindings.innerHTML += "<p>No users found</p>";
    }
  }

  function displayResourceTypeBindings(resourceTypes) {
    const resourceTypeBindings = document.getElementById(
      "resource-types-bindings"
    );
    resourceTypeBindings.innerHTML = "<h4>Resource Types</h4>";
    if (resourceTypes) {
      resourceTypes.forEach((binding) => {
        resourceTypeBindings.innerHTML += `<p>${binding.Resource_Type_Name} is ID ${binding.Resource_Type_ID}</p>`;
      });
    } else {
      resourceTypeBindings.innerHTML += "<p>No resource types found</p>";
    }
  }

  function displayResourceLimitsBindings(resourceLimits) {
    const resourceLimitsBindings = document.getElementById(
      "resource-limits-bindings"
    );
    resourceLimitsBindings.innerHTML = "<h4>Resource Limits</h4>";
    if (resourceLimits) {
      resourceLimits.forEach((binding) => {
        resourceLimitsBindings.innerHTML += `<p>Test Status ID ${binding.Status_ID} has Resource Type ID ${binding.Resource_Type_ID} with Limit ${binding.Resource_Limit}</p>`;
      });
    } else {
      resourceLimitsBindings.innerHTML += "<p>No resource limits found</p>";
    }
  }
});
function openModal(statusId, testTypeId, date, hour, userId) {
  document.getElementById("taskId").value = statusId || "";
  document.getElementById("testTypeId").value = testTypeId || "";
  document.getElementById("taskDate").value = date ? formatDate(date) : "";
  document.getElementById("taskHour").value = hour || "";
  document.getElementById("userId").value = userId || "";

  fetchResources().then(() => {
    const taskSubmitButton = document.getElementById("taskSubmitButton");
    taskSubmitButton.textContent = statusId ? "Update Task" : "Add Task";

    const modal = document.getElementById("taskModal");
    modal.style.display = "block";
    modal.setAttribute("modal-hidden", "false");
  });
}

// Function to format date as yyyy-mm-dd
// Function to format date as yyyy-mm-dd
function formatDate(date) {
  if (!(date instanceof Date)) {
    console.error("Invalid date:", date);
    return "";
  }
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addNewTest").addEventListener("click", () => {
    openModal();
  });
});

// Function to check if the given hour is within the predefined limits
function isHourWithinLimits(hour, limits) {
  if (!Array.isArray(limits)) {
    throw new Error("Limits data is not an array");
  }

  for (const limit of limits) {
    if (limit.triggerHoursList.includes(hour)) {
      return true;
    }
  }
  return false;
}
 const limitsLogic = async (hour, resourceLimitsObject, newUsagesObject) => {
  try {
    const predefinedHourlyLimits = await fetchPredefinedHourlyLimits();
     const result = isHourWithinLimits(hour, predefinedHourlyLimits);
    if (result) {
      const usageComparisonResult = compareUsages(
        resourceLimitsObject,
        newUsagesObject
      );
      return usageComparisonResult;
    }
    return result;
  } catch (error) {
    console.error("Error in limitsLogic:", error);
    return false;
  }
};

function compareUsages(resourceLimitsObject, newUsagesObject) {
  let exceededResources = [];

  resourceLimitsObject.forEach((limit) => {
    let newUsage = newUsagesObject.find(
      (usage) => usage.resourceTypeId === limit.Resource_Type_ID
    );

    if (newUsage && newUsage.usage > limit.Resource_Limit) {
      exceededResources.push({
        resourceTypeId: limit.Resource_Type_ID,
        usage: newUsage.usage,
        limit: limit.Resource_Limit,
      });
    }
  });

  if (exceededResources.length > 0) {
    console.log("Resources exceeding limits:", exceededResources);
    notifyWrapper(
      "Resource usage exceeds limits for the following resources: " +
        JSON.stringify(exceededResources)
    );
    return false;
  } else {
    console.log("No resources exceeding limits.");
    return true;
  }
}

async function fetchResources() {
  try {
    const [limitsResponse, usagesResponse, resourcesResponse] =
      await Promise.all([
        fetch("/get-predefined-resource-limits"),
        fetch("/get-predefined-resource-usages"),
        fetch("/get-resources"),
      ]);

    const [limits, usages, resources] = await Promise.all([
      limitsResponse.json(),
      usagesResponse.json(),
      resourcesResponse.json(),
    ]);

    GLOBAL_PREDEFINED_LIMITS = limits;
    GLOBAL_NEW_USAGES_FORM_DATA = usages;

    console.log("Fetched Limits:", limits);
    console.log("Fetched Usages:", usages);
    console.log("Fetched Resources:", resources);

    if (
      !Array.isArray(limits) ||
      !Array.isArray(usages) ||
      !Array.isArray(resources)
    ) {
      throw new Error("Fetched data is not an array");
    }

    const resourceFields = document.getElementById("resource-fields");
    resourceFields.innerHTML = ""; // Clear existing fields to avoid duplicates

    resources.forEach((resource) => {
      const limitOptions = limits
        .filter((limit) => limit.Resource_Type_ID === resource.id)
        .map(
          (limit) =>
            `<option value="${limit.Predefined_Limit_ID}">${limit.Predefined_Limit}</option>`
        )
        .join("");
      const usageOptions = usages
        .filter((usage) => usage.Resource_Type_ID === resource.id)
        .map(
          (usage) =>
            `<option value="${usage.Predefined_Usage_ID}">${usage.Resource_Used}</option>`
        )
        .join("");

      const resourceLimitField = document.createElement("div");
      resourceLimitField.innerHTML = `
                <label style="display:none" for="resource-limit-${resource.id}">${resource.name} Limit:</label>
                <select style="display:none"  id="resource-limit-${resource.id}" class="resource-limit" name="resource-limit-${resource.id}" data-resource-type-id="${resource.id}" required>
                    ${limitOptions}
                </select>
            `;
      resourceFields.appendChild(resourceLimitField);

      const resourceUsageField = document.createElement("div");
      resourceUsageField.innerHTML = `
                <label for="resource-usage-${resource.id}">${resource.name} Usage:</label>
                <select id="resource-usage-${resource.id}" class="resource-usage" name="resource-usage-${resource.id}" data-resource-type-id="${resource.id}" required>
                    ${usageOptions}
                </select>
            `;
      resourceFields.appendChild(resourceUsageField);
    });

    document
      .querySelectorAll(".resource-limit, .resource-usage")
      .forEach((select) => {
        select.addEventListener("change", function () {
          if (this.value === "custom") {
            const customValue = prompt("Please enter a custom value (float):");
            const floatValue = parseFloat(customValue);

            if (!isNaN(floatValue) && floatValue !== 0) {
              const option = document.createElement("option");
              option.value = floatValue;
              option.text = floatValue;
              option.selected = true;
              this.add(option);
            } else {
              this.value = ""; // Reset the select to an empty state
            }
          }
        });
      });
  } catch (error) {
    console.error("Fetch resources error:", error);
  }
}

function getTypeIdFromName(typeName) {
  typeName = typeName.replace("Test Type:", "");
  typeName = typeName.trim();
  // alert(typeName);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = "/get-id-from-type-name";

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          resolve(result.id); // Resolve with the ID
          // alert(result.id)
        } else {
          reject(new Error("Failed to fetch")); // Reject with error
        }
      }
    };

    const body = JSON.stringify({ name: typeName });
    xhr.send(body);
  });
}

function getUserIdFromName(userName, callback) {
  const xhr = new XMLHttpRequest();
  const url = "/get-id-from-username";

  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        callback(null, result.id); // Call callback with result
      } else {
        callback(new Error("Failed to fetch")); // Call callback with error
      }
    }
  };

  const body = JSON.stringify({ username: userName });
  xhr.send(body);
}

function activateEditModeBlockade(isEdit) {
  const form = document.querySelector("#taskForm");
  const blockElements = [
    form.querySelector("#testTypeId"),
    form.querySelector("#taskDate"),
    form.querySelector("#taskHour"),
    form.querySelector("#taskHourSpan"),
  ];

  blockElements.map((i) => {
    i.style.pointerEvents = "none";
    i.style.opacity = "0.6";
    i.disabled = true;
  });

  if (!isEdit)
    blockElements.map((i) => {
      i.style.pointerEvents = "auto";
      i.style.opacity = "1";
      i.disabled = false;
    });
  return;
}
async function editTask(event, statusId, testTypeId, date, hour, userId) {
  try {
    const typeName = event.target.parentNode
      .querySelector("p:nth-child(2)")
      .innerText.replace("Test Type: ", "")
      .trim();

    const dateString = event.target.parentNode
      .querySelector("p:nth-child(3)")
      .innerText.replace("Date: ", "")
      .trim();
    const [year, month, day] = dateString.split("-").map(Number);
    const dateObject = new Date(year, month - 1, day);

    testTypeId = await getTypeIdFromName(typeName);

    userId = document.getElementById("userId").value;

    openModal(statusId, testTypeId, dateObject, hour, userId);

    activateEditModeBlockade(true);
  } catch (error) {
    console.error("Error editing task:", error);
  }
}


async function deleteTask(statusId) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      const response = await fetch(`/delete-task/${statusId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      notifyWrapper("Task deleted successfully");
      const day = document.getElementById("day").value;
      const month = document.getElementById("month").value;
      const year = document.getElementById("year").value;
      fetchTasks(day, month, year);
    } catch (error) {
      console.error("Delete error:", error);
      notifyWrapper("Failed to delete task");
    }
  }
}

function checkResourceExceeds(
  resourceLimits,
  resourceUsages,
  newResourceUsages
) {
  const exceeds = [];

  const combinedUsages = resourceUsages.map((usage) => {
    const newUsage = newResourceUsages.find(
      (nu) => nu.resourceTypeId === usage.Resource_Type_ID
    );
    return {
      Resource_Type_ID: usage.Resource_Type_ID,
      Resource_Used: usage.Resource_Used + (newUsage ? newUsage.usage : 0),
    };
  });

  combinedUsages.forEach((usage) => {
    const limit = resourceLimits.find(
      (limit) => limit.Resource_Type_ID === usage.Resource_Type_ID
    );

    if (limit && usage.Resource_Used > limit.Resource_Limit) {
      exceeds.push({
        resourceTypeId: usage.Resource_Type_ID,
        usage: usage.Resource_Used,
        limit: limit.Resource_Limit,
      });
    }
  });

  return exceeds;
}

async function getResourceUsages() {
  const response = await fetch("/get-resource-usages");
  const resourceUsages = await response.json();
  if (!Array.isArray(resourceUsages)) {
    throw new Error("Fetched resource usages are not an array");
  }
  console.log(resourceUsages);
  return resourceUsages;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const resourceLimits = await getResourceLimits();
    const resourceUsages = await getResourceUsages();

    const exceededResources = checkResourceExceeds(
      resourceLimits,
      resourceUsages,
      []
    );

    if (exceededResources.length > 0) {
      console.log("Exceeded Resource Limits:", exceededResources);
    } else {
      console.log("No resource limits exceeded.");
    }
  } catch (error) {
    console.error("Error fetching resource data:", error);
  }
});

async function viewResourceUsageOfTask(taskId) {
  try {
    const response = await fetch(`/get-resource-usage/${taskId}`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const resourceUsage = await response.json();
    displayResourceUsage(taskId, resourceUsage);
  } catch (error) {
    console.error("Fetch resource usage error:", error);
  }
}

async function viewResourceLimitsOfTask(taskId) {
  try {
    const response = await fetch(`/get-resource-limits/${taskId}`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const resourceLimits = await response.json();
    displayResourceLimits(taskId, resourceLimits);
  } catch (error) {
    console.error("Fetch resource limits error:", error);
  }
}

// Function to display resource usage in the UI
function displayResourceUsage(taskId, resourceUsage) {
  popUpCloser();
  const resourceUsageContainer = document.createElement("div");
  resourceUsageContainer.classList.add("resource-usage-container");

  resourceUsageContainer.innerHTML = `<h4>Resource Usage for Task ID ${taskId}</h4><span class="closePop" onclick="popUpCloser()">&times;</span>`;

  resourceUsage.forEach((usage) => {
    resourceUsageContainer.innerHTML += `<p>Resource Type ID ${usage.Resource_Type_ID}: Used ${usage.Resource_Used}</p>`;
  });

  document
    .getElementById("tasks-container")
    .appendChild(resourceUsageContainer);
}

// Function to display resource limits in the UI
function displayResourceLimits(taskId, resourceLimits) {
  popUpCloser();
  const resourceLimitsContainer = document.createElement("div");
  resourceLimitsContainer.classList.add("resource-limits-container");

  resourceLimitsContainer.innerHTML = `<h4>Resource Limits <br><span style='font-size:12px'>(not hourly, current-test-specific. This only limits the max amount of resource for THIS test to prevent wrong inputs from users)</span> <br> for Task ID ${taskId}</h4><span class="closePop" onclick="popUpCloser()">&times;</span>`;

  resourceLimits.forEach((limit) => {
    resourceLimitsContainer.innerHTML += `<p>Resource Type ID ${limit.Resource_Type_ID}: Limit ${limit.Resource_Limit}</p>`;
  });

  document
    .getElementById("tasks-container")
    .appendChild(resourceLimitsContainer);
}

function popUpCloser() {
  document
    .querySelectorAll(".resource-usage-container")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".resource-limits-container")
    .forEach((el) => el.remove());
}

document.addEventListener("DOMContentLoaded", () => {
  // Create the modal structure dynamically
  const modal = document.createElement("div");
  modal.id = "dataModal";
  modal.style.display = "none";
  modal.style.position = "fixed";
  modal.style.zIndex = "1";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.overflow = "auto";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  modal.style.textShadow = "none";
  const modalContent = document.createElement("div");
  modalContent.style.backgroundColor = "#fefefe";
  modalContent.style.margin = "15% auto";
  modalContent.style.padding = "20px";
  modalContent.style.border = "1px solid #888";
  modalContent.style.width = "80%";
  modalContent.style.textShadow = "none";
  modalContent.style.color = "black";

  const closeBtn = document.createElement("span");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.color = "#aaa";
  closeBtn.style.float = "right";
  closeBtn.style.fontSize = "28px";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.textShadow = "none";
  closeBtn.style.color = "black";

  closeBtn.onclick = () => (modal.style.display = "none");

  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  let idBindings = {};

  function fetchIDBindings() {
    return fetch("/get-id-bindings")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok " + response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        idBindings = data;
        console.log("Fetched ID bindings:", data);
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  }

  function fetchSpecificDatetimeLimits() {
    return fetch("/get-specific-datetime-limits")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok " + response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Fetched specific datetime limits data:", data);
        return data;
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  }

  function getResourceNameById(resourceId) {
    const resource = idBindings.resourceTypes.find(
      (rt) => rt.Resource_Type_ID === resourceId
    );
    return resource ? resource.Resource_Type_Name : "Unknown";
  }

  document
    .querySelector("#showHourlyLimits")
    .addEventListener("click", async (event) => {
      await fetchIDBindings();

      const predefinedHourlyLimits = await fetchPredefinedHourlyLimits();
      const specificDatetimeLimits = await fetchSpecificDatetimeLimits();

      displayDataInModal(predefinedHourlyLimits, specificDatetimeLimits);
    });

  function displayDataInModal(predefinedHourlyLimits, specificDatetimeLimits) {
    modalContent.innerHTML = "";
    modalContent.appendChild(closeBtn);

    const predefinedHeading = document.createElement("h2");
    predefinedHeading.innerText = "Predefined Hourly Limits";
    predefinedHeading.style.textShadow = "none";

    modalContent.appendChild(predefinedHeading);

    const predefinedTable = document.createElement("table");
    predefinedTable.style.width = "100%";
    predefinedTable.style.borderCollapse = "collapse";
    predefinedTable.style.marginBottom = "20px";

    const predefinedHeaderRow = document.createElement("tr");
    predefinedHeaderRow.innerHTML = `
            <th style="border: 1px solid #ddd; padding: 8px;">ID</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Name</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Trigger Hours</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Resources</th>
        `;
    predefinedTable.appendChild(predefinedHeaderRow);

    predefinedHourlyLimits.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;">${
                  item.predefinedHourlyLimitID
                }</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${
                  item.predefinedHourlyLimitName
                }</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.triggerHoursList.join(
                  ", "
                )}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    ${item.resources
                      .map(
                        (resource) =>
                          `ID: ${
                            resource.resourceId
                          }, Name: ${getResourceNameById(
                            resource.resourceId
                          )}, Limit: ${resource.limitValue}`
                      )
                      .join("<br>")}
                </td>
            `;
      predefinedTable.appendChild(row);
    });

    modalContent.appendChild(predefinedTable);

    const specificHeading = document.createElement("h2");
    specificHeading.innerText = "Specific Datetime Limits";
    specificHeading.style.textShadow = "none";
    specificHeading.style.display = "none";

    modalContent.appendChild(specificHeading);

    const specificTable = document.createElement("table");
    specificTable.style.width = "100%";
    specificTable.style.borderCollapse = "collapse";
    specificTable.style.marginBottom = "20px";

    const specificHeaderRow = document.createElement("tr");
    specificHeaderRow.style.display = "none";
    specificHeaderRow.innerHTML = `
            <th style="border: 1px solid #ddd; padding: 8px;">ID</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Datetime</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Resource</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Limit</th>
        `;
    specificTable.appendChild(specificHeaderRow);

    specificDatetimeLimits.forEach((item) => {
      const row = document.createElement("tr");
      row.style.display = "none";
      row.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;">${
                  item.specificDatetimeID
                }</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(
                  item.datetime
                ).toLocaleString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${getResourceNameById(
                  item.resourceID
                )}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${
                  item.limit
                }</td>
            `;
      specificTable.appendChild(row);
    });

    modalContent.appendChild(specificTable);

    modal.style.display = "block";
  }
});

async function checkHourlyLimits(
  testTypeId,
  date,
  hour,
  userId,
  resourceLimitIds,
  resourceUsageIds
) {
  try {
    console.log("Starting checkHourlyLimits function");
    console.log("Parameters:", {
      testTypeId,
      date,
      hour,
      userId,
      resourceLimitIds,
      resourceUsageIds,
    });

    const response = await fetch("/get-tasks-for-status-hour", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testTypeId,
        date,
        hour,
        userId,
        resourceLimitIds,
        resourceUsageIds,
      }),
    });

    console.log("Response received from /get-tasks-for-status-hour:", response);

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const tasks = await response.json();
    console.log("Tasks fetched:", tasks);

    const resourceLimits = await getResourceLimits();
    console.log("hourly Resource limits fetched:", resourceLimits);

    const resourceUsages = tasks.map((task) => ({
      Resource_Type_ID: task.Resource_Type_ID,
      Resource_Used: task.Resource_Used,
    }));
    console.log("Mapped hourly resource usages:", resourceUsages);

    const exceededResources = checkResourceExceeds(
      resourceLimits,
      resourceUsages,
      []
    );
    console.log("Checked hourly resource exceeds:", exceededResources);

    if (exceededResources.length > 0) {
      console.log("hourly Resource limits exceeded:", exceededResources);
      return {
        testTypeId,
        date,
        hour,
        exceededResources,
      };
    } else {
      console.log("No hourly resource limits exceeded");
      return {
        testTypeId,
        date,
        hour,
        exceededResources: [],
      };
    }
  } catch (error) {
    console.error("Check hourly limits error:", error);
  }
}

//initiate loader on refresh-like actions
document.querySelector("#Show").addEventListener("click", () => {
  loaderRun();
});

//set the day dropdown to current day
document.addEventListener("DOMContentLoaded", () => {
  const day = document.getElementById("day");
  const today = new Date();
  const currentDay = today.getDate();
  day.value = currentDay;
});

const fixDateFormat = () => {
  const tasks = document.querySelectorAll(".task");
  tasks.forEach((task) => {
    const datetime = Array.from(task.querySelectorAll("p"))[2];
    datetime.textContent = datetime.textContent.slice(0, 16);
  });
};

const orderTasksByDatetime = () => {
  const container = document.getElementById("tasks-container");
  const tasks = Array.from(container.getElementsByClassName("task"));

  // Function to extract date and hour from a task element
  function extractDateTime(task) {
    const dateText = task
      .querySelector("p:nth-child(3)")
      .innerText.replace("Date: ", "");
    const hourText = task
      .querySelector("p:nth-child(4)")
      .innerText.replace("Hour: ", "");
    const dateTime = new Date(dateText);
    dateTime.setHours(hourText);
    return dateTime;
  }

  // Sort tasks based on extracted date and hour
  tasks.sort((a, b) => extractDateTime(a) - extractDateTime(b));

  // Clear the container and append sorted tasks
  container.innerHTML = "";
  tasks.forEach((task) => container.appendChild(task));
};

const groupUninterruptedlyContinuingTasks = () => {
  const container = document.getElementById("tasks-container");
  const tasks = Array.from(container.getElementsByClassName("task"));

  const getDate = (task) =>
    task.querySelector("p:nth-child(3)").innerText.replace("Date: ", "");
  const getHour = (task) =>
    parseInt(
      task.querySelector("p:nth-child(4)").innerText.replace("Hour: ", "")
    );
  const getType = (task) =>
    task.querySelector("p:nth-child(2)").innerText.replace("Type: ", "");

  // Sort tasks by hour
  tasks.sort((a, b) => getHour(a) - getHour(b));

  const groupedTasks = [];
  let currentGroup = [];

  const groupTasks = () => {
    for (let i = 0; i < tasks.length; i++) {
      const thisTask = tasks[i];

      if (currentGroup.length === 0) {
        currentGroup.push(thisTask);
      } else {
        const lastTaskInGroup = currentGroup[currentGroup.length - 1];
        if (
          getDate(thisTask) === getDate(lastTaskInGroup) &&
          getHour(thisTask) === getHour(lastTaskInGroup) + 1 &&
          getType(thisTask) === getType(lastTaskInGroup)
        ) {
          currentGroup.push(thisTask);
        } else {
          groupedTasks.push(currentGroup);
          currentGroup = [thisTask];
        }
      }
    }

    if (currentGroup.length > 0) {
      groupedTasks.push(currentGroup);
    }
  };

  const validateGroups = () => {
    return groupedTasks.flatMap((group) => {
      if (group.length === 1) return [group];

      const validatedGroup = [group[0]];
      for (let i = 1; i < group.length; i++) {
        const prevTask = validatedGroup[validatedGroup.length - 1];
        const currentTask = group[i];

        if (
          getDate(currentTask) === getDate(prevTask) &&
          getHour(currentTask) === getHour(prevTask) + 1 &&
          getType(currentTask) === getType(prevTask)
        ) {
          validatedGroup.push(currentTask);
        } else {
          if (validatedGroup.length > 1) {
            return [validatedGroup, [currentTask]];
          } else {
            return [[validatedGroup[0]], [currentTask]];
          }
        }
      }
      return [validatedGroup];
    });
  };

  groupTasks();
  const validatedGroups = validateGroups();

  container.innerHTML = "";

  validatedGroups.forEach((group, index) => {
    const groupedTasksContainer = document.createElement("div");
    groupedTasksContainer.className =
      group.length > 1 ? "grouped-tasks-container" : "not-grouped";

    if (group.length > 1) {
      const title = document.createElement("h3");
      title.textContent = "Grouped Tasks";
      groupedTasksContainer.appendChild(title);

      const expandButton = document.createElement("button");
      expandButton.className = "expand-button";
      expandButton.textContent = "Expand";
      groupedTasksContainer.appendChild(expandButton);

      expandButton.addEventListener("click", () => {
        const tasks = groupedTasksContainer.querySelectorAll(".task");
        if (expandButton.classList.contains("expand-button")) {
          tasks.forEach((task) => (task.style.display = "flex"));
          expandButton.innerText = "Collapse";
          expandButton.classList.add("collapse-button");
          expandButton.classList.remove("expand-button");
        } else {
          tasks.forEach((task) => (task.style.display = "none"));
          expandButton.innerText = "Expand";
          expandButton.classList.add("expand-button");
          expandButton.classList.remove("collapse-button");
        }
      });
    }

    group.forEach((task) => {
      groupedTasksContainer.appendChild(task);
      if (group.length > 1) {
        task.classList.add(`grouped-task-${index}`);
        task.style.display = "none"; // Initially hide grouped tasks
      }
    });

    container.appendChild(groupedTasksContainer);
  });
};

// Invoke the function to group tasks and add expandable functionality
groupUninterruptedlyContinuingTasks();

//fix the date format in every task element (only show YYY-MM-DD), not timestamp
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    fixDateFormat();
    orderTasksByDatetime();
    groupUninterruptedlyContinuingTasks();
  }, 1000);
  document.querySelector("#Show").addEventListener("click", () => {
    setTimeout(() => {
      fixDateFormat();
      orderTasksByDatetime();
      groupUninterruptedlyContinuingTasks();
    }, 1000);
  });
});

function pastHourChecker(testDate, testHour) {
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0];
  const currentHour = now.getHours();

  // Check if the test date is in the past or the test hour is in the past for today
  if (
    testDate < currentDate ||
    (testDate === currentDate && testHour < currentHour)
  ) {
    notifyWrapper("You cannot add or edit tasks for past hours or days.");
    return false;
  }
  return true;
}