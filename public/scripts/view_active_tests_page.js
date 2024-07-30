const activeWrapper = () => {
  fetch("/get-current-tests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      const testColumns = Object.keys(data[0]).filter((key) =>
        key.toLowerCase().includes("test")
      );
      let content = `
            <p>Current Hour: ${data[0].Current_Hour}</p>
            <ul>
        `;
      testColumns.forEach((column) => {
        content += `<li>${column.replace(/_/g, " ")}: ${data[0][column]}</li>`;
      });
      content += `</ul>`;
      document.getElementById("current_tests").innerHTML = content;
      checkAndProcessData(); // Call processing function after data is loaded
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  const doesThePageHaveDataNeeded = () => {
    return document.getElementById("current_tests").innerText.length > 10;
  };

  const processTests = () => {
    const current_tests = document.getElementById("current_tests").innerHTML;
    let lines = current_tests.split("</li>");

    lines = lines.map((line) => {
      line = line.replace(
        /true/gi,
        (match) =>
          `<span style="color:lightgreen;margin-bottom: 10px; display: block;"><b>${match.toUpperCase()}</b></span>`
      );
      return line;
    });

    const updatedContent = lines.join("</li>");

    // Update the DOM
    document.getElementById("current_tests").innerHTML = updatedContent;

    console.log("Updated Content: ", updatedContent);
  };

  const checkAndProcessData = () => {
    if (doesThePageHaveDataNeeded()) {
      processTests();
    } else {
      setTimeout(checkAndProcessData, 1000);
    }
  };

  document.querySelector("#goBackButton").addEventListener("click", (event) => {
    window.location.href = "/main-selection-page";
  });

  const lisFalseDestruct = () => {
    const lis = document.querySelector("ul").querySelectorAll("li");
    lis.forEach((li) => {
      if (!li.querySelector("*")) {
        li.remove();
      }
    });
  };

  setInterval(() => {
    lisFalseDestruct(), 1000;
  });
};

setTimeout(activeWrapper, 1000);