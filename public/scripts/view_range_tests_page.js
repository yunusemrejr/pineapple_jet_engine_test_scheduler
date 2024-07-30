document.addEventListener("DOMContentLoaded", () => {
  const startDay = document.getElementById("start_day");
  const startMonth = document.getElementById("start_month");
  const startYear = document.getElementById("start_year");
  const endDay = document.getElementById("end_day");
  const endMonth = document.getElementById("end_month");
  const endYear = document.getElementById("end_year");

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

  startMonth.addEventListener("change", () => {
    updateDays(startDay, parseInt(startMonth.value), parseInt(startYear.value));
  });

  startYear.addEventListener("change", () => {
    updateDays(startDay, parseInt(startMonth.value), parseInt(startYear.value));
  });

  endMonth.addEventListener("change", () => {
    updateDays(endDay, parseInt(endMonth.value), parseInt(endYear.value));
  });

  endYear.addEventListener("change", () => {
    updateDays(endDay, parseInt(endMonth.value), parseInt(endYear.value));
  });

  // Initial population of day dropdowns
  updateDays(startDay, parseInt(startMonth.value), parseInt(startYear.value));
  updateDays(endDay, parseInt(endMonth.value), parseInt(endYear.value));

  document.getElementById("Show").addEventListener("click", async () => {
    const startDayValue = startDay.value.padStart(2, "0");
    const startMonthValue = (parseInt(startMonth.value) + 1)
      .toString()
      .padStart(2, "0");
    const startYearValue = startYear.value;
    const endDayValue = endDay.value.padStart(2, "0");
    const endMonthValue = (parseInt(endMonth.value) + 1)
      .toString()
      .padStart(2, "0");
    const endYearValue = endYear.value;

    const response = await fetch("/get-tasks-within-range", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDay: startDayValue,
        startMonth: startMonthValue,
        startYear: startYearValue,
        endDay: endDayValue,
        endMonth: endMonthValue,
        endYear: endYearValue,
      }),
    });

    let tasks = await response.json();

    // Remove the T00:00:00.000Z part from the dates
    tasks = tasks.map((task) => {
      task.Date = task.Date.replace("T00:00:00.000Z", "");
      return task;
    });

    const tasksContainer = document.getElementById("tasks-container");
    tasksContainer.innerHTML = "";

    // Sorting tasks by date and then by hour
    tasks.sort((a, b) => {
      const dateA = new Date(a.Date);
      const dateB = new Date(b.Date);
      if (dateA - dateB !== 0) {
        return dateA - dateB;
      } else {
        return a.Hour - b.Hour;
      }
    });

    const groupedTasks = {};
    tasks.forEach((task) => {
      const date = task.Date;
      if (!groupedTasks[date]) {
        groupedTasks[date] = [];
      }
      groupedTasks[date].push(task);
    });

    Object.keys(groupedTasks).forEach((date) => {
      const dayContainer = document.createElement("div");
      dayContainer.classList.add("day-container");

      const dayHeader = document.createElement("div");
      dayHeader.classList.add("day-header");
      dayHeader.innerHTML = `<strong>Date:</strong> ${date} <button class="expand-btn">Expand</button>`;
      dayContainer.appendChild(dayHeader);

      const tasksList = document.createElement("div");
      tasksList.classList.add("tasks-list");
      tasksList.style.display = "none";

      groupedTasks[date].forEach((task) => {
        const taskElement = document.createElement("div");
        taskElement.classList.add("task");
        taskElement.innerHTML = `
                    <p><strong>Status ID:</strong> ${task.Status_ID}</p>
                    <p><strong>Test Type:</strong> ${task.Test_Type_Name}</p>
                    <p><strong>Hour:</strong> ${task.Hour}</p>
                    <p><strong>User:</strong> ${task.Username}</p>
                `;
        tasksList.appendChild(taskElement);
      });

      dayContainer.appendChild(tasksList);
      tasksContainer.appendChild(dayContainer);

      dayHeader.querySelector(".expand-btn").addEventListener("click", () => {
        tasksList.style.display =
          tasksList.style.display === "none" ? "block" : "none";
      });
    });
  });

  document.querySelector("#goBackButton").addEventListener("click", () => {
    window.location.href = "/main-selection-page";
  });
});