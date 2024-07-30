const sql = require("mssql");
const bcrypt = require("bcrypt");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const authRoutes = require("./auth");
const rateLimit = require("express-rate-limit");
const { resourceLimits } = require("worker_threads");
const frontendRoutes = require("./frontendRoutes"); // Import the frontend routes
const { resourceUsageOfHourTests } = require("./resourceUsage");
const adminSqlRoutes = require("./adminSqlManipulation");
const dotenv = require("dotenv");
const dayjs = require("dayjs");
const {   poolPromise } = require("./dbConfig");
const fs = require('fs');

const app = express();

// Configuration for database connection
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
  },
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "umRWksWdcNeRZaihDrbiF3ri7lndzPSu",
    resave: false,
    saveUninitialized: true,
  })
);
app.use("/auth", authRoutes);
app.use(express.static(path.join(__dirname, "public")));
app.use("/", frontendRoutes); // Use the frontend routes
app.use("/", adminSqlRoutes); // Use the admin SQL routes

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect(); // Ensures the connection is established once and reused

pool.on("error", (err) => {
  console.error("SQL Pool Error:", err);
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const gracefulShutdown = () => {
  console.log("Received signal to terminate. Shutting down gracefully...");
  server.close((err) => {
    if (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
    console.log("Closed out remaining connections.");
    process.exit(0);
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);
  res.redirect("/error?msg=" + err);
};
app.use(errorHandler);

function isSqlConnectionActive() {
  return pool.connected;
}

// Frontend routes
app.get("/", (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    res.redirect("/main-selection-page", { user: req.session.user });
  }
});

app.get("/error", (req, res) => {
  res.render("general/error_page", { message: req.query.msg });
});

app.get("/login", (req, res) => {
  if (!req.session.user) {
    res.render("general/login_page");
  } else {
    res.redirect("/main-selection-page");
  }
});

app.get("/resource-usage", async (req, res) => {
  const date = req.query.date;
  const hour = req.query.hour;

  try {
    const results = await resourceUsageOfHourTests(date, hour);
    res.json(results);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/create_user", (req, res) => {
  if (req.session.isUserAdmin) {
    res.render("admin/create_user", { user: req.session.user });
  } else {
    res.redirect("/login");
  }
});

// Backend routes
app.post("/get-tasks-for-day", async (req, res) => {
  if (req.session.user) {
    const { day, month, year } = req.body;
    const selectedDate = `${year}-${String(Number(month) + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    console.log(`Fetching tasks for date: ${selectedDate}`);

    try {
      await poolConnect;
      const request = pool.request();
      const result = await request.query(`
        SELECT 
          hts.Status_ID,
          hts.Date,
          hts.Hour,
          tt.Test_Type_Name,
          u.Username
        FROM Hourly_Test_Status hts
        JOIN Test_Types tt ON hts.Test_Type_ID = tt.Test_Type_ID
        JOIN Users u ON hts.User_ID = u.User_ID
        WHERE hts.Date = '${selectedDate}'
      `);

      if (result.recordset.length === 0) {
        console.log(`No tasks found for date: ${selectedDate}`);
      } else {
        console.log(`Tasks found: ${JSON.stringify(result.recordset)}`);
      }

      res.json(result.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.put("/admin/change-user-tests-list", async (req, res) => {
  if (req.session.isUserAdmin) {
    const { userId, testList } = req.body;

    // Validate the test list
    if (!/^\d+(,\d+)*$/.test(testList)) {
      return res.status(400).json({ message: "Invalid test list format" });
    }

    try {
      await poolConnect;

      // Update the user's test list
      const request = pool.request();
      await request
        .input("User_ID", sql.Int, userId)
        .input("Tests_It_Can_Modify", sql.VarChar, testList)
        .query(`
          UPDATE Users 
          SET Tests_It_Can_Modify = @Tests_It_Can_Modify 
          WHERE User_ID = @User_ID
        `);

      res.json({ message: "Test list updated successfully" });
    } catch (err) {
      console.error("Update User Tests List Error:", err);
      res.status(500).json({ message: "An error occurred, please try again" });
    }
  } else {
    res.redirect("/login");
  }
});


app.post("/create_user", async (req, res) => {
  if (req.session.isUserAdmin) {
    const {
      username,
      password,
      role_id,
      tests_it_can_modify,
      can_view_any_test,
    } = req.body;
    let access_type_id = role_id;

    // Check for spaces in the username
    if (/\s/.test(username)) {
      return res.render("admin/create_user", {
        message: "Username cannot contain spaces",
      });
    }

    try {
      await poolConnect;

      // Check if the username already exists
      let request = pool.request();
      const existingUserResult = await request
        .input("Username", sql.NVarChar, username)
        .query(
          "SELECT COUNT(*) AS UserCount FROM Users WHERE Username = @Username"
        );
      const userCount = existingUserResult.recordset[0].UserCount;

      if (userCount > 0) {
        return res.render("admin/create_user", {
          message: "Username already exists",
        });
      }

      // Get the next User_ID
      request = pool.request(); // Create a new request object
      const result = await request.query(
        "SELECT MAX(User_ID) AS MaxUserID FROM Users"
      );
      const maxUserId = result.recordset[0].MaxUserID || 0;

      const newUserId = maxUserId + 1;

      // Hash the password and insert the new user
      const hashedPassword = await bcrypt.hash(password, 10);
      request = pool.request(); // Create a new request object
      await request
        .input("User_ID", sql.Int, newUserId)
        .input("Username", sql.NVarChar, username)
        .input("Password", sql.NVarChar, hashedPassword)
        .input("Access_Type_ID", sql.Int, access_type_id)
        .input("Role_ID", sql.Int, role_id)
        .input("Tests_It_Can_Modify", sql.VarChar, tests_it_can_modify)
        .input("Can_View_Any_Test", sql.Int, can_view_any_test).query(`
        INSERT INTO Users (User_ID, Username, Password, Access_Type_ID, Role_ID, Tests_It_Can_Modify, Can_View_Any_Test) 
        VALUES (@User_ID, @Username, @Password, @Access_Type_ID, @Role_ID, @Tests_It_Can_Modify, @Can_View_Any_Test)
      `);
      res.render("admin/create_user", { message: "User created successfully" });
    } catch (err) {
      console.error("Create User Error:", err);
      res.render("admin/create_user", {
        message: "An error occurred, please try again",
      });
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/get-current-tests", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();
      const result = await request.query(`SELECT * FROM Current_Test_Status`);

      res.json(result.recordset); // Send the entire result set as JSON
    } catch (error) {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/get-tasks-within-range", async (req, res) => {
  if (req.session.user) {
    const { startDay, startMonth, startYear, endDay, endMonth, endYear } =
      req.body;

    const startDate = dayjs(`${startYear}-${startMonth}-${startDay}`).format(
      "YYYY-MM-DD"
    );
    const endDate = dayjs(`${endYear}-${endMonth}-${endDay}`).format(
      "YYYY-MM-DD"
    );

    try {
      await pool.connect();
      const request = pool.request();
      const query = `
                SELECT 
                    hts.Status_ID,
                    hts.Date,
                    hts.Hour,
                    tt.Test_Type_Name,
                    u.Username
                FROM Hourly_Test_Status hts
                JOIN Test_Types tt ON hts.Test_Type_ID = tt.Test_Type_ID
                JOIN Users u ON hts.User_ID = u.User_ID
                WHERE hts.Date BETWEEN @startDate AND @endDate
                ORDER BY hts.Hour
            `;
      request.input("startDate", startDate);
      request.input("endDate", endDate);

      const result = await request.query(query);
      res.json(result.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.delete("/delete-task/:id", async (req, res) => {
  if (req.session.isUserAdmin) {
    const { id } = req.params;

    try {
      await poolConnect;
      const request = pool.request();

      // First, delete the related resource limits
      await request.query(`
        DELETE FROM Resource_Limits WHERE Status_ID = ${id}
      `);

      // Next, delete the related resource usages
      await request.query(`
        DELETE FROM Resource_Usage WHERE Status_ID = ${id}
      `);

      // Finally, delete the task itself
      await request.query(`
        DELETE FROM Hourly_Test_Status WHERE Status_ID = ${id}
      `);

      res.status(200).send("Task deleted successfully");
    } catch (err) {
      console.error("Error deleting task:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Add new task endpoint with resource limits and usages
app.post("/add-task", async (req, res) => {
  if (req.session.user) {
    const {
      testTypeId,
      date,
      hour,
      userId,
      resourceLimitIds,
      resourceUsageIds,
    } = req.body;

    try {
      await poolConnect;
      const request = pool.request();

      // Check hourly resource limits
      const hourlyLimits = await request.query(`
        SELECT Predefined_Hourly_Limit_ID, Applied_Resources_ID_List, Applied_Resources_Limit_Values_List
        FROM Predefined_Hourly_Limits
      `);

      const resourceLimits = {};

      for (const limit of hourlyLimits.recordset) {
        const { Predefined_Hourly_Limit_ID, Applied_Resources_ID_List, Applied_Resources_Limit_Values_List } = limit;
        const appliedResourcesIds = Applied_Resources_ID_List.split(",");
        const appliedResourcesLimits = Applied_Resources_Limit_Values_List.split(",");

        for (let i = 0; i < appliedResourcesIds.length; i++) {
          resourceLimits[Predefined_Hourly_Limit_ID] = resourceLimits[Predefined_Hourly_Limit_ID] || {};
          resourceLimits[Predefined_Hourly_Limit_ID][appliedResourcesIds[i]] = Number(appliedResourcesLimits[i]);
        }
      }

      const existingTasks = await request.query(`
        SELECT hts.Status_ID, ru.Resource_Type_ID, SUM(ru.Resource_Used) AS Total_Usage
        FROM Hourly_Test_Status hts
        JOIN Resource_Usage ru ON hts.Status_ID = ru.Status_ID
        WHERE hts.Date = '${date}' AND hts.Hour = ${hour}
        GROUP BY hts.Status_ID, ru.Resource_Type_ID
      `);

      for (const task of existingTasks.recordset) {
        const { Status_ID, Resource_Type_ID, Total_Usage } = task;

        if (resourceLimits[Status_ID] && resourceLimits[Status_ID][Resource_Type_ID] && Total_Usage + resourceUsageIds[Resource_Type_ID] > resourceLimits[Status_ID][Resource_Type_ID]) {
          res.status(400).send(`Hourly resource limit exceeded for resource type ${Resource_Type_ID}`);
          return;
        }
      }

      for (const limitId of resourceLimitIds) {
        const limit = await request.query(`
          SELECT Resource_Type_ID, Predefined_Limit
          FROM Predefined_Resource_Limits
          WHERE Predefined_Limit_ID = ${limitId}
        `);

        const { Resource_Type_ID, Predefined_Limit } = limit.recordset[0];
        const hourlyLimit = hourlyLimits.recordset.find(
          (limit) => limit.Resource_Type_ID === Resource_Type_ID
        );

        if (hourlyLimit && hourlyLimit.Resource_Limit < Predefined_Limit) {
          res.status(400).send("Hourly resource limit exceeded");
          return;
        }
      }

      // Insert new task
      const taskResult = await request.query(`
        INSERT INTO Hourly_Test_Status (Test_Type_ID, Date, Hour, User_ID)
        OUTPUT INSERTED.Status_ID
        VALUES (${testTypeId}, '${date}', ${hour}, ${userId})
      `);

      const statusId = taskResult.recordset[0].Status_ID;

      // Insert resource limits
      for (const limitId of resourceLimitIds) {
        const limit = await request.query(`
          SELECT Resource_Type_ID, Predefined_Limit
          FROM Predefined_Resource_Limits
          WHERE Predefined_Limit_ID = ${limitId}
        `);

        const { Resource_Type_ID, Predefined_Limit } = limit.recordset[0];
        await request.query(`
          INSERT INTO Resource_Limits (Status_ID, Resource_Type_ID, Resource_Limit)
          VALUES (${statusId}, ${Resource_Type_ID}, ${Predefined_Limit})
        `);
      }

      // Insert resource usages
      for (const usageId of resourceUsageIds) {
        const usage = await request.query(`
          SELECT Resource_Type_ID, Resource_Used
          FROM Predefined_Resource_Usage
          WHERE Predefined_Usage_ID = ${usageId}
        `);

        const { Resource_Type_ID, Resource_Used } = usage.recordset[0];
        await request.query(`
          INSERT INTO Resource_Usage (Status_ID, Resource_Type_ID, Resource_Used)
          VALUES (${statusId}, ${Resource_Type_ID}, ${Resource_Used})
        `);
      }

      res.status(201).send("Task added successfully");
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Edit task endpoint with resource limits and usages
app.put("/edit-task/:id", async (req, res) => {
  if (req.session.user) {
    const { id } = req.params;
    const {
      testTypeId,
      date,
      hour,
      userId,
      resourceLimitIds,
      resourceUsageIds,
    } = req.body;

    try {
      await poolConnect;
      const request = pool.request();
      await request.query(`
        UPDATE Hourly_Test_Status
        SET Test_Type_ID = ${testTypeId}, Date = '${date}', Hour = ${hour}, User_ID = ${userId}
        WHERE Status_ID = ${id}
      `);

      // Update resource limits
      await request.query(`
        DELETE FROM Resource_Limits WHERE Status_ID = ${id}
      `);
      for (const limitId of resourceLimitIds) {
        const limit = await request.query(
          `SELECT Resource_Type_ID, Predefined_Limit FROM Predefined_Resource_Limits WHERE Predefined_Limit_ID = ${limitId}`
        );
        const { Resource_Type_ID, Predefined_Limit } = limit.recordset[0];
        await request.query(`
          INSERT INTO Resource_Limits (Status_ID, Resource_Type_ID, Resource_Limit)
          VALUES (${id}, ${Resource_Type_ID}, ${Predefined_Limit})
        `);
      }

      // Update resource usages
      await request.query(`
        DELETE FROM Resource_Usage WHERE Status_ID = ${id}
      `);
      for (const usageId of resourceUsageIds) {
        const usage = await request.query(
          `SELECT Resource_Type_ID, Resource_Used FROM Predefined_Resource_Usage WHERE Predefined_Usage_ID = ${usageId}`
        );
        const { Resource_Type_ID, Resource_Used } = usage.recordset[0];
        await request.query(`
          INSERT INTO Resource_Usage (Status_ID, Resource_Type_ID, Resource_Used)
          VALUES (${id}, ${Resource_Type_ID}, ${Resource_Used})
        `);
      }

      res.status(200).send("Task updated successfully");
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get foreign key mappings
app.get("/get-id-bindings", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const testTypesResult = await request.query(`
        SELECT Test_Type_ID, Test_Type_Name
        FROM Test_Types
      `);

      const usersResult = await request.query(`
        SELECT User_ID, Username
        FROM Users
      `);

      const resourceTypesResult = await request.query(`
        SELECT Resource_Type_ID, Resource_Type_Name
        FROM Resource_Types
      `);

      const resourceLimitsResult = await request.query(`
        SELECT Status_ID, Resource_Type_ID, Resource_Limit
        FROM Resource_Limits
      `);

      const roleIdsResult = await request.query(`
        SELECT Access_Type_ID, Access_Type_Name
        FROM Access_Types;
 

      `);

      const idBindings = {
        testTypes: testTypesResult.recordset || [],
        users: usersResult.recordset || [],
        resourceTypes: resourceTypesResult.recordset || [],
        resourceLimits: resourceLimitsResult.recordset || [],
        roleIds: roleIdsResult.recordset || [],
      };

      res.json(idBindings);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get resource usages
// Endpoint to get resource usages
app.get("/get-resource-usages", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const resourceUsageResult = await request.query(`
        SELECT Status_ID, Resource_Type_ID, Resource_Used
        FROM Resource_Usage
      `);

      res.json(resourceUsageResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get resource limits
app.get("/get-resource-limits", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const resourceLimitsResult = await request.query(`
        SELECT Status_ID, Resource_Type_ID, Resource_Limit
        FROM Resource_Limits
      `);

      res.json(resourceLimitsResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});
app.post("/get-tasks-for-status-hour", async (req, res) => {
  if (req.session.user) {
    const {
      testTypeId,
      date,
      hour,
      userId,
      resourceLimitIds,
      resourceUsageIds,
    } = req.body;

    try {
      await poolConnect;
      const request = pool.request();

      const result = await request.query(`
              SELECT 
                  hts.Status_ID,
                  hts.Date,
                  hts.Hour,
                  ru.Resource_Type_ID,
                  ru.Resource_Used
              FROM Hourly_Test_Status hts
              JOIN Resource_Usage ru ON hts.Status_ID = ru.Status_ID
              WHERE hts.Test_Type_ID = ${testTypeId}
              AND hts.Date = '${date}'
              AND hts.Hour = ${hour}
              AND hts.User_ID = ${userId}
          `);

      if (result.recordset.length === 0) {
        console.log(
          `No tasks found for Test Type ID: ${testTypeId}, Date: ${date}, Hour: ${hour}, User ID: ${userId}`
        );
        res.json([]);
      } else {
        console.log(`Tasks found: ${JSON.stringify(result.recordset)}`);
        res.json(result.recordset);
      }
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get available resources
app.get("/get-resources", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const resourcesResult = await request.query(`
        SELECT Resource_Type_ID AS id, Resource_Type_Name AS name
        FROM Resource_Types
      `);

      res.json(resourcesResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

const updateCurrentTests = async () => {
  try {
    await poolConnect;
    const request = pool.request();

    await request.query("UPDATE Current_Test_Status SET Scheduler_Running=1");
    await request.query(
      `UPDATE Current_Test_Status SET Current_Hour=${new Date().getHours()}`
    );

    const columnsResult = await request.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Current_Test_Status' AND COLUMN_NAME NOT IN ('Scheduler_Running', 'Current_Hour')"
    );
    const columns = columnsResult.recordset.map((row) => row.COLUMN_NAME);

    console.log("Columns:", columns);

    const currentDate = new Date().toISOString().split("T")[0];
    const currentHour = new Date().getHours();

    const findCurrentHourQuery = `
      SELECT Status_ID, Test_Type_ID, Date, Hour, User_ID
      FROM pineapple.dbo.Hourly_Test_Status
      WHERE Date = @currentDate
      AND Hour = @currentHour
    `;
    console.log("Raw SQL Query:", findCurrentHourQuery);
    const findCurrentHourResult = await request
      .input("currentDate", currentDate)
      .input("currentHour", currentHour)
      .query(findCurrentHourQuery);
    const currentHourTests = findCurrentHourResult.recordset;

    console.log("Current Hour:", currentHour);
    console.log("Current Date:", currentDate);
    console.log("Current Hour Tests:", currentHourTests);

    if (currentHourTests.length === 0) {
      console.log("No tests found for the current hour.");
    }

    let updateQuery = "UPDATE Current_Test_Status SET ";
    const columnUpdates = columns
      .map((col) => {
        const testTypeIdMatch = col.match(/Test_(\d+)_Runnable/);
        if (testTypeIdMatch) {
          const testTypeId = parseInt(testTypeIdMatch[1], 10);
          const isCurrentHourTest = currentHourTests.some(
            (test) => test.Test_Type_ID === testTypeId
          );
          console.log(
            `Column: ${col}, Test_Type_ID: ${testTypeId}, Is Current Hour Test: ${isCurrentHourTest}`
          );
          return `${col}=${isCurrentHourTest ? 1 : 0}`;
        }
        return null;
      })
      .filter(Boolean)
      .join(", ");
    updateQuery += columnUpdates;

    console.log("Update Query:", updateQuery);

    if (columnUpdates) {
      await request.query(updateQuery);
    }
  } catch (err) {
    console.error("Current Hour Update Error:", err);
  }
};

const startUpdatingCurrentTests = () => {
  setInterval(updateCurrentTests, 10000); // Run every 10 seconds
};

startUpdatingCurrentTests();

// Endpoint to get resource usage for a specific task
app.get("/get-resource-usage/:taskId", async (req, res) => {
  if (req.session.user) {
    const { taskId } = req.params;
    try {
      await poolConnect;
      const request = pool.request();

      const resourceUsageResult = await request.query(`
        SELECT Resource_Type_ID, Resource_Used
        FROM Resource_Usage
        WHERE Status_ID = ${taskId}
      `);

      res.json(resourceUsageResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/get-predefined-hourly-limits", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const result = await request.query(`
        SELECT 
          Predefined_Hourly_Limit_ID, 
          Predefined_Hourly_Limit_Name, 
          Trigger_Hours_List, 
          Applied_Resources_ID_List, 
          Applied_Resources_Limit_Values_List 
        FROM Predefined_Hourly_Limits
      `);

      const formattedData = result.recordset.map((row) => {
        const triggerHoursList = row.Trigger_Hours_List.split(",").map(Number);
        const appliedResourcesIDList =
          row.Applied_Resources_ID_List.split(",").map(Number);
        const appliedResourcesLimitValuesList =
          row.Applied_Resources_Limit_Values_List.split(",").map(Number);

        const resources = appliedResourcesIDList.map((resourceId, index) => ({
          resourceId,
          limitValue: appliedResourcesLimitValuesList[index],
        }));

        return {
          predefinedHourlyLimitID: row.Predefined_Hourly_Limit_ID,
          predefinedHourlyLimitName: row.Predefined_Hourly_Limit_Name,
          triggerHoursList,
          resources,
        };
      });

      res.json(formattedData);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Add the endpoint to fetch data from Specific_Datetime_Limits
app.get("/get-specific-datetime-limits", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      const result = await request.query(`
        SELECT 
          Specific_Datetime_ID, 
          Datetime, 
          Resource_ID, 
          Limit 
        FROM Specific_Datetime_Limits
      `);

      const formattedData = result.recordset.map((row) => ({
        specificDatetimeID: row.Specific_Datetime_ID,
        datetime: row.Datetime,
        resourceID: row.Resource_ID,
        limit: row.Limit,
      }));

      res.json(formattedData);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

//
app.get("/get-resource-names", async (req, res) => {
  if (req.session.user) {
    const { resourceId } = req.params;
    try {
      await poolConnect;
      const request = pool.request();

      const resourceLimitsResult = await request.query(`
        SELECT Resource_Type_ID, Resource_Limit
        FROM Resource_Limits
        WHERE Status_ID = ${taskId}
      `);

      res.json(resourceLimitsResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

//

app.post("/get-id-from-type-name", async (req, res) => {
  if (req.session.user) {
    const { name } = req.body;
    try {
      await poolConnect; // Assuming poolConnect is your database connection pool

      const request = pool.request();
      const getIDResults = await request.input("name", sql.NVarChar, name)
        .query(`
          SELECT Test_Type_ID 
          FROM Test_Types
          WHERE Test_Type_Name = @name
        `);

      // Check if any results were returned
      const id =
        getIDResults.recordset.length > 0
          ? getIDResults.recordset[0].Test_Type_ID
          : null;

      res.json({
        id: id,
      });
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login"); // Redirect to login if user session is not valid
  }
});

app.post("/get-id-from-username", async (req, res) => {
  if (req.session.user) {
    const { username } = req.body;
    try {
      await poolConnect; // Assuming poolConnect is your database connection pool

      const request = pool.request();
      const getUserIdResults = await request.input(
        "username",
        sql.NVarChar,
        username
      ).query(`
          SELECT User_ID 
          FROM Users
          WHERE Username = @username
        `);

      res.json({
        id:
          getUserIdResults.recordset.length > 0
            ? getUserIdResults.recordset[0].User_ID
            : null,
      });
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get resource limits for a specific task
app.get("/get-resource-limits/:taskId", async (req, res) => {
  if (req.session.user) {
    const { taskId } = req.params;
    try {
      await poolConnect;
      const request = pool.request();

      const resourceLimitsResult = await request.query(`
        SELECT Resource_Type_ID, Resource_Limit
        FROM Resource_Limits
        WHERE Status_ID = ${taskId}
      `);

      res.json(resourceLimitsResult.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get resource limits and usages for a specific date and hour
app.post("/get-resource-usage-limits", async (req, res) => {
  if (req.session.user) {
    const { date, hour } = req.body;
    try {
      await poolConnect;
      const request = pool.request();

      const resourceLimitsResult = await request.query(`
        SELECT Resource_Type_ID, Resource_Limit
        FROM Resource_Limits
        WHERE Status_ID IN (SELECT Status_ID FROM Hourly_Test_Status WHERE Date = '${date}' AND Hour = ${hour})
      `);

      const resourceUsageResult = await request.query(`
        SELECT Resource_Type_ID, SUM(Resource_Used) AS Resource_Used
        FROM Resource_Usage
        WHERE Status_ID IN (SELECT Status_ID FROM Hourly_Test_Status WHERE Date = '${date}' AND Hour = ${hour})
        GROUP BY Resource_Type_ID
      `);

      res.json({
        resourceLimits: resourceLimitsResult.recordset || [],
        resourceUsages: resourceUsageResult.recordset || [],
      });
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get predefined resource limits
app.get("/get-predefined-resource-limits", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();
      const result = await request.query(`
        SELECT Predefined_Limit_ID, Resource_Type_ID, Predefined_Limit
        FROM Predefined_Resource_Limits
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

// Endpoint to get predefined resource usages
app.get("/get-predefined-resource-usages", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();
      const result = await request.query(`
        SELECT Predefined_Usage_ID, Resource_Type_ID, Resource_Used
        FROM Predefined_Resource_Usage
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/analyze-hourly-tasks", async (req, res) => {
  if (req.session.user) {
    try {
      await poolConnect;
      const request = pool.request();

      // Fetch all hourly tasks
      const tasksResult = await request.query(`
        SELECT hts.Status_ID, hts.Date, hts.Hour, hts.Test_Type_ID, ru.Resource_Type_ID, ru.Resource_Used
        FROM Hourly_Test_Status hts
        JOIN Resource_Usage ru ON hts.Status_ID = ru.Status_ID
        WHERE hts.Date >= CAST(GETDATE() AS DATE)
        `);

      // Fetch predefined hourly limits
      const limitsResult = await request.query(`
        SELECT phl.Predefined_Hourly_Limit_ID, phl.Predefined_Hourly_Limit_Name, phl.Trigger_Hours_List, phl.Applied_Resources_ID_List, phl.Applied_Resources_Limit_Values_List
        FROM Predefined_Hourly_Limits phl
      `);

      const predefinedLimits = limitsResult.recordset.map(row => {
        const triggerHoursList = row.Trigger_Hours_List.split(',').map(Number);
        const appliedResourcesIDList = row.Applied_Resources_ID_List.split(',').map(Number);
        const appliedResourcesLimitValuesList = row.Applied_Resources_Limit_Values_List.split(',').map(Number);

        const resources = appliedResourcesIDList.map((resourceId, index) => ({
          resourceId,
          limitValue: appliedResourcesLimitValuesList[index],
        }));

        return {
          predefinedHourlyLimitID: row.Predefined_Hourly_Limit_ID,
          predefinedHourlyLimitName: row.Predefined_Hourly_Limit_Name,
          triggerHoursList,
          resources,
        };
      });

      // Process tasks and compare with limits
      const analysis = {};

      tasksResult.recordset.forEach(task => {
        const { Status_ID, Date, Hour, Test_Type_ID, Resource_Type_ID, Resource_Used } = task;

        const matchingLimit = predefinedLimits.find(limit =>
          limit.triggerHoursList.includes(Hour) &&
          limit.resources.some(resource => resource.resourceId === Resource_Type_ID)
        );

        if (matchingLimit) {
          const resourceLimit = matchingLimit.resources.find(resource => resource.resourceId === Resource_Type_ID).limitValue;
          const key = `${Date}-${Hour}-${matchingLimit.predefinedHourlyLimitName}`;

          if (!analysis[key]) {
            analysis[key] = {
              statusId: Status_ID,
              hour: Hour,
              date: Date,
              limitName: matchingLimit.predefinedHourlyLimitName,
              testTypeId: Test_Type_ID,
              resourceUsage: {},
              limitExceeded: false,
              exceedingResources: [],
            };
          }

          if (!analysis[key].resourceUsage[Resource_Type_ID]) {
            analysis[key].resourceUsage[Resource_Type_ID] = 0;
          }

          analysis[key].resourceUsage[Resource_Type_ID] += Resource_Used;

          if (analysis[key].resourceUsage[Resource_Type_ID] > resourceLimit) {
            analysis[key].limitExceeded = true;
            analysis[key].exceedingResources.push({
              resourceTypeId: Resource_Type_ID,
              used: analysis[key].resourceUsage[Resource_Type_ID],
              limit: resourceLimit,
            });
          }
        }
      });

      const response = Object.values(analysis).map(entry => ({
        statusId: entry.statusId,
        hour: entry.hour,
        date: entry.date,
        limitName: entry.limitName,
        testTypeId: entry.testTypeId,
        limitExceeded: entry.limitExceeded,
        exceedingResources: entry.exceedingResources,
      }));

      res.json(response);
    } catch (err) {
      console.error("Error analyzing hourly tasks:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});


// Endpoint to check if a new task can be added
app.post("/can-add-task", async (req, res) => {
  if (req.session.user) {
    const {
      testTypeId,
      date,
      hour,
      userId,
      resourceLimitIds,
      resourceUsageIds,
    } = req.body;

    try {
      await poolConnect;
      const request = pool.request();

      // Query current resource usage for the specified date and hour
      const currentUsageResult = await request.query(`
        SELECT Resource_Type_ID, SUM(Resource_Used) AS Total_Used
        FROM Resource_Usage
        WHERE Status_ID IN (SELECT Status_ID FROM Hourly_Test_Status WHERE Date = '${date}' AND Hour = ${hour})
        GROUP BY Resource_Type_ID
      `);

      // Query predefined resource limits
      const limitsResult = await request.query(`
        SELECT Resource_Type_ID, Predefined_Limit
        FROM Predefined_Resource_Limits
        WHERE Predefined_Limit_ID IN (${resourceLimitIds.join(",")})
      `);

      const currentUsage = currentUsageResult.recordset.reduce((acc, row) => {
        acc[row.Resource_Type_ID] = row.Total_Used;
        return acc;
      }, {});

      const limits = limitsResult.recordset.reduce((acc, row) => {
        acc[row.Resource_Type_ID] = row.Predefined_Limit;
        return acc;
      }, {});

      // Calculate if new task can be added
      let canAddTask = true;
      for (const resourceId of resourceUsageIds) {
        const usage = await request.query(
          `SELECT Resource_Type_ID, Resource_Used FROM Predefined_Resource_Usage WHERE Predefined_Usage_ID = ${resourceId}`
        );
        const { Resource_Type_ID, Resource_Used } = usage.recordset[0];

        const currentUsed = currentUsage[Resource_Type_ID] || 0;
        const limit = limits[Resource_Type_ID] || 0;

        if (currentUsed + Resource_Used > limit) {
          canAddTask = false;
          break;
        }
      }

      res.json({ canAddTask });
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});

 



app.get("/get-daily-test-summary/:date", async (req, res) => {
  if (req.session.user) {
    const { date } = req.params;
    try {
      await poolConnect;
      const request = pool.request();

      const query = `
        SELECT 
            hts.Status_ID,
            tt.Test_Type_Name,
            hts.Test_Type_ID,
            hts.Date,
            hts.Hour,
            ru.Resource_Type_ID,
            ru.Resource_Used,
            phl.Predefined_Hourly_Limit_Name,
            phl.Trigger_Hours_List,
            phl.Applied_Resources_ID_List,
            phl.Applied_Resources_Limit_Values_List
        FROM Hourly_Test_Status hts
        JOIN Test_Types tt ON hts.Test_Type_ID = tt.Test_Type_ID
        JOIN Resource_Usage ru ON hts.Status_ID = ru.Status_ID
        JOIN Predefined_Hourly_Limits phl ON CHARINDEX(CAST(hts.Hour AS VARCHAR), phl.Trigger_Hours_List) > 0
        WHERE hts.Date = @date
        ORDER BY hts.Hour;
      `;

      const result = await request.input('date', sql.Date, date).query(query);

      // Process the data
      const testSummary = result.recordset.reduce((acc, row) => {
        const { Status_ID, Test_Type_Name, Test_Type_ID, Date, Hour, Resource_Type_ID, Resource_Used, Predefined_Hourly_Limit_Name, Trigger_Hours_List, Applied_Resources_ID_List, Applied_Resources_Limit_Values_List } = row;
        
        // Find the predefined limits
        const predefinedLimits = {
          Predefined_Hourly_Limit_Name,
          Trigger_Hours_List: Trigger_Hours_List.split(',').map(Number),
          Resources: Applied_Resources_ID_List.split(',').map((id, index) => ({
            resourceId: Number(id),
            limitValue: Number(Applied_Resources_Limit_Values_List.split(',')[index])
          }))
        };

        if (!acc[Status_ID]) {
          acc[Status_ID] = {
            Status_ID,
            Test_Type_Name,
            Test_Type_ID,
            Date,
            Hour,
            Resources: {},
            PredefinedLimits: predefinedLimits,
          };
        }

        // Calculate available resources and potential additional tests
        if (!acc[Status_ID].Resources[Resource_Type_ID]) {
          acc[Status_ID].Resources[Resource_Type_ID] = {
            Resource_Type_ID,
            Resource_Used: 0,
            Limit: predefinedLimits.Resources.find(r => r.resourceId === Resource_Type_ID).limitValue,
          };
        }

        acc[Status_ID].Resources[Resource_Type_ID].Resource_Used += Resource_Used;

        return acc;
      }, {});

      // Calculate how many additional tests can be added
      Object.values(testSummary).forEach(test => {
        test.AvailableResources = {};
        test.AdditionalTestsPossible = {};

        Object.values(test.Resources).forEach(resource => {
          const available = resource.Limit - resource.Resource_Used;
          test.AvailableResources[resource.Resource_Type_ID] = available;
          test.AdditionalTestsPossible[resource.Resource_Type_ID] = Math.floor(available / resource.Resource_Used);
        });
      });
     console.log(testSummary);
      res.json(Object.values(testSummary));
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("/login");
  }
});


 

app.get("/shutdown", async (req, res) => {
  if (req.session.user.userRole == 1) {
    try {
      await poolConnect;
      const request = pool.request();

      await request.query("UPDATE Current_Test_Status SET Scheduler_Running=0");

      const columnsResult = await request.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Current_Test_Status' AND COLUMN_NAME NOT IN ('Scheduler_Running')"
      );
      const columns = columnsResult.recordset.map((row) => row.COLUMN_NAME);

      const updateQuery = `UPDATE Current_Test_Status SET ${columns
        .map((col) => `${col}=0`)
        .join(", ")}`;
      await request.query(updateQuery);

      res.render("general/app_shutdown");
      gracefulShutdown();
    } catch (err) {
      console.error("Shutdown Error:", err);
      res.render("general/login_page", {
        message: "An error occurred, please try again",
      });
    }
  } else {
    res.redirect("/login");
  }
});

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);