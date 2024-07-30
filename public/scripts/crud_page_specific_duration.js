/**
 * Removes the default "Add Task" submit button at the end of the page.
 * This button is added by default by the CRUD form in the admin panel.
 */
function removeAddTaskDefaultSubmitButtonAtEnd() {
  // Get the submit button element by its ID
  const submitButton = document.getElementById("taskSubmitButton");

  // Remove the submit button from the page
  submitButton.remove();
}
/**
 * Checks if a task is in the past based on the task start date, time, and duration.
 * Displays an alert message if the task is in the past.
 *
 * @param {string} taskDate - The date of the task in 'YYYY-MM-DD' format.
 * @param {number} startHour - The start hour of the task.
 * @param {number} duration - The duration of the task in hours.
 * @returns {boolean} - True if the task is not in the past, false otherwise.
 */
function checkIfPastTask(taskDate, startHour, duration) {
  // Get the current date and time
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Calculate the start and end time of the task
  const taskStart = new Date(`${taskDate}T${startHour}:00`);
  const taskEnd = new Date(taskStart.getTime() + duration * 60 * 60 * 1000);

  // Check if the task start time is in the past
  if (
    taskStart < now ||
    (taskStart.getTime() === now.getTime() && currentMinute > 0)
  ) {
    notifyWrapper("You cannot add or edit tasks that start in the past.");
    return false;
  }

  // Check if the task end time is in the past
  if (taskEnd < now) {
    notifyWrapper("You cannot add or edit tasks that end in the past.");
    return false;
  }

  return true;
}






/**
 * Checks if the test can be added based on resource limits.
 * Makes an asynchronous request to the backend to verify resource availability.
 *
 * @param {Object} requestBody - The request body containing the date, hour, and resources.
 * @returns {Promise<boolean>} - Returns true if the test can be added, false otherwise.
 */
async function addDurationalTask(event) {
  event.preventDefault();

  const taskId = document.getElementById("taskId").value;
  const testTypeId = document.getElementById("testTypeId").value;
  const taskDate = document.getElementById("taskDate").value;
  const duration = parseInt(document.getElementById("duration").value);
  const startHour = parseInt(document.getElementById("startHour").value);
  const userId = document.getElementById("userId").innerText;

  // Client-side validation
  if (
    !testTypeId ||
    !taskDate ||
    isNaN(duration) ||
    isNaN(startHour) ||
    !userId
  ) {
    notifyWrapper("Please fill all required fields with valid data.");
    return;
  }

  if (!checkIfPastTask(taskDate, startHour, duration)) {
    return; // Block the form submission if the task is in the past
  }

  const endHour = startHour + duration;

  for (let taskHour = startHour; taskHour < endHour; taskHour++) {
    // Create the request body for the test
    const requestBody = {
      date: taskDate,
      hour: taskHour,
      resources: Array.from(document.querySelectorAll(".resource"))
        .map(resource => ({
          resourceId: parseInt(resource.dataset.id),
          value: parseInt(resource.value),
        })),
    };

  
  }

  // If all checks pass, submit the task
  try {
    const requestBody = {
      testTypeId,
      date: taskDate,
      hour: startHour,
      duration,
      userId,
    };

    const response = await fetch('/add-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    notifyWrapper('Task added successfully');
    document.getElementById('detailedSubmitButtton').style.display = 'none';
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error('Error adding task:', error);
  }
}







/**
 * Handles the submission of a durational task form.
 * Checks if the task is in the past, and if not, checks the resource limits for each hour within the duration.
 * If the resource limits are exceeded, displays an alert message and prevents the form submission.
 *
 * @param {Event} event - The submission event.
 */
async function addDurationalTask(event) {
  event.preventDefault();

  const taskId = document.getElementById("taskId").value;
  const testTypeId = document.getElementById("testTypeId").value;
  const taskDate = document.getElementById("taskDate").value;
  const duration = parseInt(document.getElementById("duration").value);
  const startHour = parseInt(document.getElementById("startHour").value);
  const userId = document.getElementById("userId").innerText;

  // Client-side validation
  if (
    !testTypeId ||
    !taskDate ||
    isNaN(duration) ||
    isNaN(startHour) ||
    !userId
  ) {
    notifyWrapper("Please fill all required fields with valid data.");
    return;
  }

  if (!checkIfPastTask(taskDate, startHour, duration)) {
    return; // Block the form submission if the task is in the past
  }

  const endHour = startHour + duration;

  // Check resource limits for each hour within the duration
  for (let taskHour = startHour; taskHour < endHour; taskHour++) {
    try {
      // Fetch the resource usage for the current hour
      const response = await fetch(
        `/resource-usage?date=${taskDate}&hour=${taskHour}`
      );
      if (!response.ok)
        throw new Error("Network response was not ok " + response.statusText);

      const data = await response.json();
      if (data.length > 0) {
        notifyWrapper(
          "Resource limits exceeded for hour " +
            taskHour +
            ". Please check the usage."
        );
        return;
      } else {
        console.log("No resource limits exceeded for hour " + taskHour + ".");


     

        // Create the request body for the task
        const requestBody = {
          testTypeId,
          date: taskDate,
          hour: taskHour,
          userId,
          resourceLimitIds: Array.from(
            document.querySelectorAll(".resource-limit")
          ).map((select) => parseInt(select.value)),
          resourceUsageIds: Array.from(
            document.querySelectorAll(".resource-usage")
          ).map((select) => parseInt(select.value)),
        };


      


        // Make the request to add the task
        const response = await fetch("/add-task", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        notifyWrapper("Task added successfully");
        document.getElementById("detailedSubmitButtton").style.display = "none";
        setTimeout(() => location.reload(), 4000);

      }
    } catch (error) {
      console.error(
        "Error fetching resource usage for hour " + taskHour + ":",
        error
      );
      return;
    }
  }

  try {
    // Check the resource limits for each hour within the duration
    for (let taskHour = startHour; taskHour < endHour; taskHour++) {
      const result = await checkHourlyLimits(
        testTypeId,
        taskDate,
        taskHour,
        userId,
        requestBody.resourceLimitIds,
        requestBody.resourceUsageIds
      );
      if (result.exceededResources.length > 0) {
        notifyWrapper(
          "Resource limits exceeded for hour " +
            taskHour +
            ": " +
            JSON.stringify(result.exceededResources)
        );
        return;
      }
    }
  } catch (error) {
    console.error("Submit error:", error);
    // setTimeout(() => alert('Failed to submit task'), 1000); // alert('Failed to submit task');
  }
}

/**
 * Adds a new submit button for adding detailed tasks.
 * The button is styled and positioned, and it triggers the 'addDurationalTask' function when clicked.
 */
function addNewSubmitButtonForAdd() {
  // Create a submit button element
  const submitButton = document.createElement("button");
  submitButton.id = "detailedSubmitButtton"; // Set the ID of the button
  submitButton.textContent = "Add Task"; // Set the text content of the button

  // Set the styling of the button
  submitButton.style.display = "block";
  submitButton.style.margin = "auto";
  submitButton.style.padding = "10px 20px";
  submitButton.style.fontSize = "16px";
  submitButton.style.backgroundColor = "navy";
  submitButton.style.color = "white";
  submitButton.style.border = "none";
  submitButton.style.borderRadius = "5px";
  submitButton.style.cursor = "pointer";
  submitButton.style.marginTop = "10px";
  submitButton.style.marginBottom = "10px";

  // Add a click event listener to the button that triggers the 'addDurationalTask' function
  submitButton.addEventListener("click", (event) => {
    addDurationalTask(event);
  });

  // Append the button to the task form
  document.getElementById("taskForm").appendChild(submitButton);
}

/**
 * Modifies the UI to allow adding tasks with a specific duration and start hour.
 * Removes the default hour input and adds new inputs for duration and start hour.
 * Disables the submit button until the hour inputs are valid.
 */
function dateRangeModeForAdd() {
  // Get the normal hour input element
  const normalHourInput = document.getElementById("taskHour");

  // Create new inputs for duration and start hour
  const newInputs = document.createElement("div");
  newInputs.innerHTML = `
    <!-- Duration input -->
    <label for="duration">Duration:</label>
    <input type="number" id="duration" name="duration" min="1" max="24" value="1">
    
    <!-- Start hour input -->
    <label for="startHour">Start Hour: <span style='display:none;font-size:10px;color:red'>*enter the initial hour -1. For example enter 22 if you want to start at 23</span> </label>
    <input type="time" id="startHour" name="startHour" min="0" max="23" value="0">   `;

  // Insert the new inputs before the normal hour input and remove the normal hour input
  normalHourInput.parentNode.insertBefore(newInputs, normalHourInput);
  normalHourInput.remove();

  // Remove the default submit button and add a new submit button
  document.querySelector("#taskHourSpan").remove();
  document.querySelector('label[for="taskHour"]').remove();
  removeAddTaskDefaultSubmitButtonAtEnd();
  addNewSubmitButtonForAdd();

  // Add event listeners to validate the hour inputs on change
  document.querySelector("#duration").addEventListener("change", () => {
    checkTimeLogic();
  });

  document.querySelector("#startHour").addEventListener("change", () => {
    checkTimeLogic();
  });

  // Disable the submit button until the hour inputs are valid
  const submitButton = document.getElementById("taskSubmitButton");
  submitButton.style.pointerEvents = "none";
  submitButton.style.opacity = "0.5";
}

/**
 * Checks whether the start hour and end hour (calculated from the start hour and duration) are valid.
 * If either the start hour or end hour is greater than 23:59, it alerts the user and disables the submit button.
 * Otherwise, it enables the submit button.
 */
function checkTimeLogic() {
  const duration = document.getElementById("duration").value;
  const startHour = document.getElementById("startHour").value;
  const endHour = parseInt(startHour) + parseInt(duration);

  // Check if start hour or end hour is greater than 23:59
  if (startHour > 23.59 || endHour > 23.59) {
    notifyWrapper("Start or end hour is greater than 23:59");

    // Disable submit button
    const submitButton = document.getElementById("taskSubmitButton");
    submitButton.style.pointerEvents = "none";
    submitButton.style.opacity = "0.5";
  } else {
    // Enable submit button
    const submitButton = document.getElementById("taskSubmitButton");
    submitButton.style.pointerEvents = "auto";
    submitButton.style.opacity = "1";
  }
}