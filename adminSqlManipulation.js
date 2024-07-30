

const express = require("express");
const bcrypt = require("bcrypt");
const { sql, poolPromise } = require("./dbConfig");

const router = express.Router();

// Middleware to check if the user is an admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.Access_Type_ID == 1) {
    next();
  } else {
    res.json({ message: "You do not have permission to access this page." });
  }
};

// Endpoint to get combined data from Permissions, Access_Types, and User_Access_Test_Types
router.post("/get-combined-data", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;

    const permissionsQuery = `SELECT Permission_ID, Permission_Name FROM [dbo].[Permissions]`;
    const accessTypesQuery = `SELECT Access_Type_ID, Access_Type_Name FROM [dbo].[Access_Types]`;
    const userAccessTestTypesQuery = `SELECT Access_Type_ID, Test_Type_ID FROM [dbo].[User_Access_Test_Types]`;

    const [permissionsResult, accessTypesResult, userAccessTestTypesResult] =
      await Promise.all([
        pool.request().query(permissionsQuery),
        pool.request().query(accessTypesQuery),
        pool.request().query(userAccessTestTypesQuery),
      ]);

    const combinedData = {
      permissions: permissionsResult.recordset,
      accessTypes: accessTypesResult.recordset,
      userAccessTestTypes: userAccessTestTypesResult.recordset,
    };

    res.json(combinedData);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get all users
router.post("/admin/get-users", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const usersQuery = `SELECT User_ID, Username, Access_Type_ID FROM Users`;
    const usersResult = await pool.request().query(usersQuery);
    res.json(usersResult.recordset);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to delete a user
router.delete("/admin/delete-user/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request().query(`DELETE FROM Users WHERE User_ID = ${id}`);
    res.status(200).send("User deleted successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to change a user's name
router.put("/admin/change-username", isAdmin, async (req, res) => {
  try {
    const { userId, newUsername } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("User_ID", sql.Int, userId)
      .input("Username", sql.NVarChar, newUsername)
      .query(`UPDATE Users SET Username = @Username WHERE User_ID = @User_ID`);
    res.status(200).send("Username updated successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to change a user's role
router.put("/admin/change-user-role", isAdmin, async (req, res) => {
  try {
    const { userId, newRoleId } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("User_ID", sql.Int, userId)
      .input("Access_Type_ID", sql.Int, newRoleId)
      .query(
        `UPDATE Users SET Access_Type_ID = @Access_Type_ID WHERE User_ID = @User_ID`
      );
    res.status(200).send("User role updated successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to change a user's password
router.put("/admin/change-password", isAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const pool = await poolPromise;
    await pool
      .request()
      .input("User_ID", sql.Int, userId)
      .input("Password", sql.NVarChar, hashedPassword)
      .query(`UPDATE Users SET Password = @Password WHERE User_ID = @User_ID`);
    res.status(200).send("Password updated successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get predefined data
router.get("/admin/predefined-data", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;

    const resourceTypesQuery = `SELECT Resource_Type_ID, Resource_Type_Name FROM [dbo].[Resource_Types]`;
    const resourceTypesResult = await pool.request().query(resourceTypesQuery);

    const predefinedLimitsQuery = `SELECT Predefined_Hourly_Limit_ID, Predefined_Hourly_Limit_Name, Trigger_Hours_List, Applied_Resources_ID_List, Applied_Resources_Limit_Values_List FROM [dbo].[Predefined_Hourly_Limits]`;
    const predefinedLimitsResult = await pool
      .request()
      .query(predefinedLimitsQuery);

    const predefinedUsagesQuery = `SELECT Predefined_Usage_ID, Resource_Type_ID, Resource_Used FROM [dbo].[Predefined_Resource_Usage]`;
    const predefinedUsagesResult = await pool
      .request()
      .query(predefinedUsagesQuery);

    const formattedLimits = predefinedLimitsResult.recordset.map((row) => {
      const triggerHoursList = row.Trigger_Hours_List.split(",").map(Number);
      const appliedResourcesIDList =
        row.Applied_Resources_ID_List.split(",").map(Number);
      const appliedResourcesLimitValuesList =
        row.Applied_Resources_Limit_Values_List.split(",").map(Number);

      const resources = appliedResourcesIDList.map((resourceId, index) => ({
        resourceId,
        resourceName: resourceTypesResult.recordset.find(
          (rt) => rt.Resource_Type_ID === resourceId
        ).Resource_Type_Name,
        limitValue: appliedResourcesLimitValuesList[index],
      }));

      return {
        predefinedHourlyLimitID: row.Predefined_Hourly_Limit_ID,
        predefinedHourlyLimitName: row.Predefined_Hourly_Limit_Name,
        triggerHoursList,
        resources,
      };
    });

    res.json({
      resourceTypes: resourceTypesResult.recordset,
      predefinedLimits: formattedLimits,
      predefinedUsages: predefinedUsagesResult.recordset,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to update an existing predefined hourly limit
router.post(
  "/admin/edit-predefined-hourly-limit",
  isAdmin,
  async (req, res) => {
    const {
      predefinedLimitId,
      predefinedHourlyLimitName,
      triggerHoursList,
      resources,
    } = req.body;
    try {
      const pool = await poolPromise;
      const request = pool.request();

      await request.query(`
          UPDATE Predefined_Hourly_Limits
          SET
              Predefined_Hourly_Limit_Name = '${predefinedHourlyLimitName}',
              Trigger_Hours_List = '${triggerHoursList.join(",")}',
              Applied_Resources_ID_List = '${resources
                .map((r) => r.resourceId)
                .join(",")}',
              Applied_Resources_Limit_Values_List = '${resources
                .map((r) => r.limitValue)
                .join(",")}'
          WHERE Predefined_Hourly_Limit_ID = ${predefinedLimitId}
      `);

      res.status(200).send("Predefined hourly limit updated successfully");
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Endpoint to update permissions for a specific role
router.post("/admin/update-role-permissions", isAdmin, async (req, res) => {
  const { roleId, permissions } = req.body;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    // Reset all permissions for the role
    await request.query(`
          UPDATE Access_Type_Permissions
          SET Allowed = 0
          WHERE Access_Type_ID = ${roleId}
      `);

    // Set the allowed permissions
    for (const permissionId of permissions) {
      await request.query(`
              UPDATE Access_Type_Permissions
              SET Allowed = 1
              WHERE Access_Type_ID = ${roleId} AND Permission_ID = ${permissionId}
          `);
    }

    res.status(200).send("Permissions updated successfully");
  } catch (error) {
    console.error("Error updating role permissions:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to create a new predefined hourly limit
router.post(
  "/admin/create-predefined-hourly-limit",
  isAdmin,
  async (req, res) => {
    const { predefinedHourlyLimitName, triggerHoursList, resources } = req.body;
    try {
      const pool = await poolPromise;
      const request = pool.request();

      const result = await request.query(`
          INSERT INTO Predefined_Hourly_Limits (Predefined_Hourly_Limit_Name, Trigger_Hours_List, Applied_Resources_ID_List, Applied_Resources_Limit_Values_List)
          OUTPUT INSERTED.Predefined_Hourly_Limit_ID
          VALUES (
              '${predefinedHourlyLimitName}',
              '${triggerHoursList.join(",")}',
              '${resources.map((r) => r.resourceId).join(",")}',
              '${resources.map((r) => r.limitValue).join(",")}'
          )
      `);

      res
        .status(201)
        .json({
          predefinedHourlyLimitID:
            result.recordset[0].Predefined_Hourly_Limit_ID,
        });
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Endpoint to delete a predefined hourly limit
router.delete(
  "/admin/delete-predefined-hourly-limit/:id",
  isAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await poolPromise;
      const request = pool.request();

      await request.query(
        `DELETE FROM Predefined_Hourly_Limits WHERE Predefined_Hourly_Limit_ID = ${id}`
      );

      res.status(200).send("Predefined hourly limit deleted successfully");
    } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.post("/admin/edit-predefined", isAdmin, async (req, res) => {
  const {
    predefinedLimitId,
    resourceTypeId,
    predefinedLimit,
    predefinedUsageId,
    newPredefinedUsage,
    resourceUsed,
  } = req.body;
  try {
    const pool = await poolPromise;

    // Update predefined resource limit
    await pool
      .request()
      .input("Predefined_Limit_ID", sql.Int, predefinedLimitId)
      .input("Resource_Type_ID", sql.Int, resourceTypeId)
      .input("Predefined_Limit", sql.Float, predefinedLimit).query(`
          UPDATE Predefined_Resource_Limits 
          SET Resource_Type_ID = @Resource_Type_ID, Predefined_Limit = @Predefined_Limit 
          WHERE Predefined_Limit_ID = @Predefined_Limit_ID
        `);

    let predefinedUsageIdToUse = predefinedUsageId;

    // Insert new predefined usage if provided
    if (!predefinedUsageId && newPredefinedUsage) {
      const result = await pool
        .request()
        .input("Resource_Type_ID", sql.Int, resourceTypeId)
        .input("Resource_Used", sql.Float, newPredefinedUsage).query(`
            INSERT INTO Predefined_Resource_Usage (Resource_Type_ID, Resource_Used) 
            OUTPUT INSERTED.Predefined_Usage_ID
            VALUES (@Resource_Type_ID, @Resource_Used)
          `);
      predefinedUsageIdToUse = result.recordset[0].Predefined_Usage_ID;
    }

    // Update predefined resource usage
    await pool
      .request()
      .input("Predefined_Usage_ID", sql.Int, predefinedUsageIdToUse)
      .input("Resource_Type_ID", sql.Int, resourceTypeId)
      .input("Resource_Used", sql.Float, resourceUsed).query(`
          UPDATE Predefined_Resource_Usage 
          SET Resource_Type_ID = @Resource_Type_ID, Resource_Used = @Resource_Used 
          WHERE Predefined_Usage_ID = @Predefined_Usage_ID
        `);

    res
      .status(200)
      .send("Predefined resource limits and usages updated successfully");
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get roles and permissions data
router.get("/admin/roles-data", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;

    const rolesQuery = `SELECT Access_Type_ID AS roleId, Access_Type_Name AS roleName FROM [dbo].[Access_Types]`;
    const permissionsQuery = `SELECT Permission_ID AS permissionId, Permission_Name AS permissionName FROM [dbo].[Permissions]`;
    const rolePermissionsQuery = `SELECT Access_Type_ID AS roleId, Permission_ID AS permissionId FROM [dbo].[Access_Type_Permissions]`;

    const [rolesResult, permissionsResult, rolePermissionsResult] =
      await Promise.all([
        pool.request().query(rolesQuery),
        pool.request().query(permissionsQuery),
        pool.request().query(rolePermissionsQuery),
      ]);

    const roles = rolesResult.recordset.map((role) => {
      const rolePermissions = rolePermissionsResult.recordset
        .filter((rp) => rp.roleId === role.roleId)
        .map((rp) => ({
          permissionId: rp.permissionId,
          permissionName: permissionsResult.recordset.find(
            (p) => p.permissionId === rp.permissionId
          ).permissionName,
        }));
      return {
        ...role,
        permissions: rolePermissions,
      };
    });

    res.json({
      roles,
      permissions: permissionsResult.recordset,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});
// Endpoint to create a new role

// Endpoint to create a new role
router.post("/admin/create-role", isAdmin, async (req, res) => {
  const { roleId, roleName, rolePermissions } = req.body;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    await request
      .input("roleId", sql.Int, roleId)
      .input("roleName", sql.NVarChar, roleName).query(`
        INSERT INTO [dbo].[Access_Types] (Access_Type_ID, Access_Type_Name)
        VALUES (@roleId, @roleName)
      `);

    for (const permissionId of rolePermissions) {
      await request
        .input("roleId", sql.Int, roleId)
        .input("permissionId", sql.Int, permissionId).query(`
          INSERT INTO [dbo].[Access_Type_Permissions] (Access_Type_ID, Permission_ID, Allowed)
          VALUES (@roleId, @permissionId, 1)
        `);
    }

    res.status(201).send("Role created successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to edit an existing role
router.post("/admin/edit-role", isAdmin, async (req, res) => {
  const { roleId, roleName, rolePermissions } = req.body;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    await request.query(`
      UPDATE [dbo].[Access_Types]
      SET Access_Type_Name = '${roleName}'
      WHERE Access_Type_ID = ${roleId}
    `);

    await request.query(`
      DELETE FROM [dbo].[Access_Type_Permissions]
      WHERE Access_Type_ID = ${roleId}
    `);

    for (const permissionId of rolePermissions) {
      await request.query(`
        INSERT INTO [dbo].[Access_Type_Permissions] (Access_Type_ID, Permission_ID, Allowed)
        VALUES (${roleId}, ${permissionId}, 1)
      `);
    }

    res.status(200).send("Role updated successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get roles and permissions data
router.get("/admin/roles-and-permissions", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;

    const rolesQuery = `SELECT Access_Type_ID AS roleId, Access_Type_Name AS roleName FROM [dbo].[Access_Types]`;
    const permissionsQuery = `SELECT Permission_ID AS permissionId, Permission_Name AS permissionName FROM [dbo].[Permissions]`;
    const rolePermissionsQuery = `SELECT Access_Type_ID AS roleId, Permission_ID AS permissionId FROM [dbo].[Access_Type_Permissions]`;

    const [rolesResult, permissionsResult, rolePermissionsResult] =
      await Promise.all([
        pool.request().query(rolesQuery),
        pool.request().query(permissionsQuery),
        pool.request().query(rolePermissionsQuery),
      ]);

    const roles = rolesResult.recordset.map((role) => {
      const rolePermissions = rolePermissionsResult.recordset
        .filter((rp) => rp.roleId === role.roleId)
        .map((rp) => ({
          permissionId: rp.permissionId,
          permissionName: permissionsResult.recordset.find(
            (p) => p.permissionId === rp.permissionId
          ).permissionName,
        }));
      return {
        ...role,
        permissions: rolePermissions,
      };
    });

    res.json({
      roles,
      permissions: permissionsResult.recordset,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to delete a role
router.delete("/admin/delete-role/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    await request.query(`
      DELETE FROM [dbo].[Access_Type_Permissions]
      WHERE Access_Type_ID = ${id}
    `);

    await request.query(`
      DELETE FROM [dbo].[Access_Types]
      WHERE Access_Type_ID = ${id}
    `);

    res.status(200).send("Role deleted successfully");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get all test types
router.get("/admin/get-test-types", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Test_Types");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching test types:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to delete a test type
router.delete("/admin/delete-test-type/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    await request
      .input("Test_Type_ID", sql.Int, id)
      .query("DELETE FROM Test_Types WHERE Test_Type_ID = @Test_Type_ID");

    await deleteColumnFromCurrentTests(`Test_${id}_Runnable`);

    res.status(200).send("Deleted successfully");
  } catch (error) {
    if (
      error.originalError &&
      error.originalError.info &&
      error.originalError.info.number === 547
    ) {
      // Foreign Key constraint error
      res
        .status(400)
        .send(
          "This test type is connected to other data and cannot be deleted."
        );
    } else {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    }
  }
});

// Endpoint to edit test types
router.post("/admin/edit-test-types", isAdmin, async (req, res) => {
  const { testTypes } = req.body;
  try {
    const pool = await poolPromise;

    for (const testType of testTypes) {
      const request = pool.request(); // Create a new request object for each iteration

      if (testType.name.trim() === "") {
        // Delete test type if name is empty
        await request
          .input("Test_Type_ID", sql.Int, testType.id)
          .query("DELETE FROM Test_Types WHERE Test_Type_ID = @Test_Type_ID");

        await deleteColumnFromCurrentTests(`Test_${testType.id}_Runnable`);
      } else {
        // Upsert (insert or update) test type
        await request
          .input("Test_Type_ID", sql.Int, testType.id)
          .input("Test_Type_Name", sql.NVarChar, testType.name).query(`
                    IF EXISTS (SELECT 1 FROM Test_Types WHERE Test_Type_ID = @Test_Type_ID)
                    BEGIN
                        UPDATE Test_Types
                        SET Test_Type_Name = @Test_Type_Name
                        WHERE Test_Type_ID = @Test_Type_ID
                    END
                    ELSE
                    BEGIN
                        INSERT INTO Test_Types (Test_Type_ID, Test_Type_Name)
                        VALUES (@Test_Type_ID, @Test_Type_Name)
                    END
                  `);

        await addNewColumnToCurrentTests(`Test_${testType.id}_Runnable`);
      }
    }

    res.status(200).send("Test types updated successfully");
  } catch (error) {
    console.error("Error updating test types:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Add a new column to Current_Test_Status
const addNewColumnToCurrentTests = async (column) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    const result = await request.query(
      `ALTER TABLE Current_Test_Status ADD ${column} BIT DEFAULT 0`
    );
    console.log(result);
  } catch (err) {
    console.error("Error executing query:", err);
  }
};

// Delete a column from Current_Test_Status, including default constraints and indexes
const deleteColumnFromCurrentTests = async (column) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    // Find and drop default constraints related to the column
    const defaultConstraintsResult = await request.query(`
      SELECT name AS constraint_name
      FROM sys.default_constraints
      WHERE parent_object_id = OBJECT_ID('dbo.Current_Test_Status') AND col_name(parent_object_id, parent_column_id) = '${column}'
    `);

    for (const row of defaultConstraintsResult.recordset) {
      await request.query(
        `ALTER TABLE Current_Test_Status DROP CONSTRAINT ${row.constraint_name}`
      );
    }

    // Find and drop constraints related to the column
    const constraintsResult = await request.query(`
      SELECT constraint_name
      FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE
      WHERE table_name = 'Current_Test_Status' AND column_name = '${column}'
    `);

    for (const row of constraintsResult.recordset) {
      await request.query(
        `ALTER TABLE Current_Test_Status DROP CONSTRAINT ${row.constraint_name}`
      );
    }

    // Find and drop indexes related to the column
    const indexesResult = await request.query(`
      SELECT i.name AS index_name
      FROM sys.indexes AS i
      INNER JOIN sys.index_columns AS ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns AS c ON ic.object_id = c.object_id AND c.column_id = ic.column_id
      INNER JOIN sys.tables AS t ON c.object_id = t.object_id
      WHERE t.name = 'Current_Test_Status' AND c.name = '${column}'
    `);

    for (const row of indexesResult.recordset) {
      await request.query(
        `DROP INDEX ${row.index_name} ON Current_Test_Status`
      );
    }

    // DROP DROP DROP the column
    const result = await request.query(
      `ALTER TABLE Current_Test_Status DROP COLUMN ${column}`
    );
    console.log(result);
  } catch (err) {
    console.error("Error executing query:", err);
  }
};

// THE ENDPOINT to get ALL OF THE resource TYPES!!!
router.get("/admin/get-resource-types", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Resource_Types");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching resource types:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to edit resource types
router.post("/admin/edit-resource-types", isAdmin, async (req, res) => {
  const { resourceTypes } = req.body;
  console.log(resourceTypes);
  try {
    const pool = await poolPromise;

    for (const resourceType of resourceTypes) {
      const request = pool.request(); // Create a new request object for each iteration

      if (resourceType.name.trim() === "") {
        // Delete resource type if name is empty
        console.log(`Deleting resource type with ID: ${resourceType.id}`);
        await request
          .input("Resource_Type_ID", sql.Int, resourceType.id)
          .query(
            "DELETE FROM Resource_Types WHERE Resource_Type_ID = @Resource_Type_ID"
          );
      } else {
        if (resourceType.id === 0) {
          // Insert new resource type
          let newId = null;
          console.log(
            `Inserting new resource type with ID: ${newId} and Name: ${resourceType.name}`
          );
          await request
            .input("Resource_Type_Name", sql.NVarChar, resourceType.name)
            .query(
              "INSERT INTO Resource_Types ( Resource_Type_Name) VALUES ( @Resource_Type_Name)"
            );
        } else {
          // Update existing resource type
          console.log(
            `Updating resource type with ID: ${resourceType.id} and Name: ${resourceType.name}`
          );
          await request
            .input("Resource_Type_ID", sql.Int, resourceType.id)
            .input("Resource_Type_Name", sql.NVarChar, resourceType.name)
            .query(`
                          IF EXISTS (SELECT 1 FROM Resource_Types WHERE Resource_Type_ID = @Resource_Type_ID)
                          BEGIN
                              UPDATE Resource_Types
                              SET Resource_Type_Name = @Resource_Type_Name
                              WHERE Resource_Type_ID = @Resource_Type_ID
                          END
                      `);
        }
      }
    }

    res.status(200).send("Resource types updated successfully");
  } catch (error) {
    console.error("Error updating resource types:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to delete a resource type
router.delete("/admin/delete-resource-type/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const request = pool.request();

    await request
      .input("Resource_Type_ID", sql.Int, id)
      .query(
        "DELETE FROM Resource_Types WHERE Resource_Type_ID = @Resource_Type_ID"
      );

    res.status(200).send("Deleted successfully");
  } catch (error) {
    if (
      error.originalError &&
      error.originalError.info &&
      error.originalError.info.number === 547
    ) {
      // Foreign Key constraint error
      res
        .status(400)
        .send(
          "This resource type is connected to other data and cannot be deleted."
        );
    } else {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    }
  }
});

////
///

// Endpoint to get all predefined limits
router.get("/admin/get-predefined-limits", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT Predefined_Hourly_Limit_ID, Predefined_Hourly_Limit_Name FROM Predefined_Hourly_Limits"
      );
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching predefined limits:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get all predefined usages
router.get("/admin/get-predefined-usages", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT Predefined_Usage_ID, Resource_Type_ID, Resource_Used FROM Predefined_Resource_Usage"
      );
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching predefined usages:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to delete a predefined limit
router.delete(
  "/admin/delete-predefined-limit/:id",
  isAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("Predefined_Hourly_Limit_ID", sql.Int, id)
        .query(
          "DELETE FROM Predefined_Hourly_Limits WHERE Predefined_Hourly_Limit_ID = @Predefined_Hourly_Limit_ID"
        );

      res.status(200).send("Deleted successfully");
    } catch (error) {
      console.error("Error deleting predefined limit:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Endpoint to delete a predefined usage
router.delete(
  "/admin/delete-predefined-usage/:id",
  isAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("Predefined_Usage_ID", sql.Int, id)
        .query(
          "DELETE FROM Predefined_Resource_Usage WHERE Predefined_Usage_ID = @Predefined_Usage_ID"
        );

      res.status(200).send("Deleted successfully");
    } catch (error) {
      console.error("Error deleting predefined usage:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

///
///

// Endpoint to ensure all resource types have a predefined limit
router.get("/admin/ensure-predefined-limits", isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;

    // Get all resource types
    const resourceTypesQuery = `SELECT Resource_Type_ID FROM [dbo].[Resource_Types]`;
    const resourceTypesResult = await pool.request().query(resourceTypesQuery);
    const resourceTypeIds = resourceTypesResult.recordset.map(
      (row) => row.Resource_Type_ID
    );

    // Get all resource types that already have a limit
    const predefinedLimitsQuery = `SELECT Resource_Type_ID FROM [dbo].[Predefined_Resource_Limits]`;
    const predefinedLimitsResult = await pool
      .request()
      .query(predefinedLimitsQuery);
    const predefinedLimitTypeIds = new Set(
      predefinedLimitsResult.recordset.map((row) => row.Resource_Type_ID)
    );

    // Find resource types without a predefined limit
    const missingResourceTypes = resourceTypeIds.filter(
      (id) => !predefinedLimitTypeIds.has(id)
    );

    // Insert missing predefined limits
    for (const resourceId of missingResourceTypes) {
      await pool
        .request()
        .input("Resource_Type_ID", sql.Int, resourceId)
        .input("Predefined_Limit", sql.Float, 999999999).query(`
          INSERT INTO [dbo].[Predefined_Resource_Limits] (Resource_Type_ID, Predefined_Limit)
          VALUES (@Resource_Type_ID, @Predefined_Limit)
        `);
    }

    res.status(200).send("Predefined limits ensured successfully");
  } catch (error) {
    console.error("Error ensuring predefined limits:", error);
    res.status(500).send("Internal Server Error");
  }
});

////

module.exports = router;
