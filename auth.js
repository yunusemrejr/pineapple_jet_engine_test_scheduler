 
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const bcrypt = require("bcrypt");
require("dotenv").config();
const {   poolPromise } = require("./dbConfig");

// SQL configuration
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

// Connection pool
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on("error", (err) => {
  console.error("SQL Pool Error:", err);
});

// Route to render login page
router.get("/login", (req, res) => {
  if (req.session.user) {
    res.redirect("/main-selection-page");
    return;
  }
  res.render("general/login_page");
});

async function getTestsUserCanModify(userId) {
  try {
    await poolConnect;
    const request = pool.request();
    request.input("userId", sql.Int, userId);
    const result = await request.query(
      "SELECT Tests_It_Can_Modify FROM Users WHERE User_ID = @userId"
    );
    return result.recordset;
  } catch (error) {
    console.error("Error executing query:", error);
    return [];
  }
}

async function getCanViewAnyTest(userId) {
  try {
    await poolConnect;
    const request = pool.request();
    request.input("userId", sql.Int, userId);
    const result = await request.query(
      "SELECT Can_View_Any_Test FROM Users WHERE User_ID = @userId"
    );
    return result.recordset[0].Can_View_Any_Test;
  } catch (error) {
    console.error("Error executing query:", error);
    return [];
  }
}

async function updateSqlAboutAppRunningAndTimestamp() {
  try {
    const hour = new Date().getHours();
    console.log("Hour:", hour, typeof hour);

    await poolConnect;
    const request = pool.request();
    request.input("hour", sql.Int, hour);
    const result = await request.query(
      "UPDATE Current_Test_Status SET Current_Hour = @hour, Scheduler_Running = 1"
    );
    console.log(result);
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

router.post("/get-current-tests", async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    const result = await request.query("SELECT * FROM Current_Test_Status");

    res.json(result.recordset); // Send the entire result set as JSON
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

async function authenticateUser(username, password) {
  try {
    await poolConnect;
    const request = pool.request();
    request.input("username", sql.VarChar, username);
    const result = await request.query(
      "SELECT * FROM Users WHERE Username = @username"
    );

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log("User found:", user);

      if (!user.Password) {
        console.error("No password found for user:", user);
        return { success: false, message: "Invalid username or password" };
      }

      const match = await bcrypt.compare(password, user.Password);
      if (match) {
        return { success: true, user };
      } else {
        return { success: false, message: "Invalid username or password" };
      }
    } else {
      return { success: false, message: "Invalid username or password" };
    }
  } catch (err) {
    console.error("Login Error:", err);
    return { success: false, message: "An error occurred, please try again" };
  }
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const authResult = await authenticateUser(username, password);

  if (authResult.success) {
    const user = authResult.user;
    req.session.user = user;
    req.session.userId = user.User_ID; // Store user ID in session

    req.session.isUserAdmin = user.Access_Type_ID === 1;
    req.session.canUserCreate =
      user.Access_Type_ID === 1 || user.Access_Type_ID === 2;
    req.session.canUserEdit =
      user.Access_Type_ID === 1 || user.Access_Type_ID === 2;
    req.session.canUserDelete = user.Access_Type_ID === 1;

    req.session.testsUserCanModify = await getTestsUserCanModify(user.User_ID);
    req.session.canUserViewAnyTest = await getCanViewAnyTest(user.User_ID);

    console.log(
      req.session.isUserAdmin,
      "...",
      req.session.canUserCreate,
      "...",
      req.session.canUserEdit,
      "...",
      req.session.canUserDelete,
      "...",
      req.session.testsUserCanModify
    );

    await updateSqlAboutAppRunningAndTimestamp();
    setInterval(updateSqlAboutAppRunningAndTimestamp, 10000);

    req.session.user.userRole = user.Access_Type_ID;

    try {
      await poolConnect;
      const request = pool.request();
      request.input("userId", sql.Int, user.User_ID);
      const userRoleQuery = `
        SELECT Access_Type_Name 
        FROM Access_Types 
        WHERE Access_Type_ID IN (
          SELECT Access_Type_ID 
          FROM Access_Type_Permissions 
          WHERE Allowed = 1 
          AND Permission_ID IN (
            SELECT Permission_ID 
            FROM User_Permissions 
            WHERE User_ID = @userId
          )
        )
      `;

      const result = await request.query(userRoleQuery);
      const userRole = result.recordset[0];
      console.log(userRole);

      req.session.user.userRoleName = userRole;
    } catch (error) {
      console.error("Error executing query:", error);
    }

    try {
      await poolConnect;
      const request = pool.request();
      request.input("userId", sql.Int, user.User_ID);
      const userPermissionsQuery = `
        SELECT Permission_Name  
        FROM Permissions 
        WHERE Permission_ID IN (
          SELECT Permission_ID 
          FROM User_Permissions 
          WHERE User_ID = @userId
        )
      `;
      const userPermissions = await request.query(userPermissionsQuery);
      req.session.user.userPermissions = userPermissions.recordset;

      res.redirect("/main-selection-page");
    } catch (error) {
      console.error("Error executing query:", error);
      res.render("general/error_page", {
        message: "An error occurred, please try again",
      });
    }
  } else {
    res.render("general/login_page", { message: authResult.message });
  }
});

// Route to handle logout
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("general/error_page");
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

module.exports = router;
