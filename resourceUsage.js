const {  poolPromise } = require("./dbConfig");
const fs = require('fs');

async function resourceUsageOfHourTests(date, hour) {
  try {
    console.log(`Checking resource usage for Date: ${date}, Hour: ${hour}`);
    const pool = await poolPromise;
    const request = pool.request();

    // Retrieve predefined limits
    const predefinedLimitsResult = await request.query(`
        SELECT 
            phl.[Predefined_Hourly_Limit_ID],
            phl.[Predefined_Hourly_Limit_Name],
            phl.[Trigger_Hours_List],
            phl.[Applied_Resources_ID_List],
            phl.[Applied_Resources_Limit_Values_List]
        FROM 
            [pineapple].[dbo].[Predefined_Hourly_Limits] phl;
    `);

    console.log(`Predefined Limits: ${JSON.stringify(predefinedLimitsResult.recordset)}`);
    fs.writeFileSync('predefinedLimits.json', JSON.stringify(predefinedLimitsResult.recordset, null, 2));
    fs.writeFileSync('log.txt', `Predefined Limits: ${JSON.stringify(predefinedLimitsResult.recordset, null, 2)}\n`);

    // Parse predefined limits
    const parsedLimits = parsePredefinedLimits(predefinedLimitsResult.recordset);
    const parsedLimitMap = parsedLimits.reduce((map, limit) => {
      for (const [resourceID, limitValue] of Object.entries(limit.Parsed_Limits)) {
        map[resourceID] = limitValue;
      }
      return map;
    }, {});

    // Convert parsed limits to SQL CASE format
    const caseStatement = Object.entries(parsedLimitMap).map(([resourceID, limitValue]) => {
      return `WHEN ru.[Resource_Type_ID] = ${resourceID} THEN ${limitValue}`;
    }).join(' ');

    const resourceUsageQuery = `
      DECLARE @TargetDate DATE = '${date}';
      DECLARE @TargetHour INT = ${hour};

      SELECT 
          hts.[Status_ID],
          hts.[Test_Type_ID],
          hts.[Date],
          hts.[Hour],
          hts.[User_ID],
          ru.[Resource_Type_ID],
          rt.[Resource_Type_Name],
          ru.[Resource_Used],
          CASE
              ${caseStatement}
              ELSE 0
          END AS [Predefined_Limit]
      FROM 
          [pineapple].[dbo].[Hourly_Test_Status] hts
      LEFT JOIN 
          [pineapple].[dbo].[Resource_Usage] ru ON hts.[Status_ID] = ru.[Status_ID]
      LEFT JOIN 
          [pineapple].[dbo].[Resource_Types] rt ON ru.[Resource_Type_ID] = rt.[Resource_Type_ID]
      WHERE 
          hts.[Date] = @TargetDate
          AND hts.[Hour] = @TargetHour
          AND ru.[Resource_Used] > (
              CASE
                  ${caseStatement}
                  ELSE 0
              END
          );
    `;

    console.log(`Resource Usage Query: ${resourceUsageQuery}`);
    fs.writeFileSync('resourceUsageQuery.sql', resourceUsageQuery);
    fs.appendFileSync('log.txt', `Resource Usage Query: ${resourceUsageQuery}\n`);

    const resourceUsageResult = await request.query(resourceUsageQuery);

    console.log(`Query result: ${JSON.stringify(resourceUsageResult.recordset)}`);
    fs.writeFileSync('queryResult.json', JSON.stringify(resourceUsageResult.recordset, null, 2));
    fs.appendFileSync('log.txt', `Query result: ${JSON.stringify(resourceUsageResult.recordset, null, 2)}\n`);

    return compareUsageToLimit(resourceUsageResult.recordset);
  } catch (err) {
    console.error("Error executing query:", err);
    fs.appendFileSync('log.txt', `Error executing query: ${err}\n`);
    return [];
  }
}

function compareUsageToLimit(resourceUsage) {
  return resourceUsage.map((record) => {
    const isLimitExceeded = record.Resource_Used > record.Predefined_Limit;
    console.log(`Comparing usage to limit: ${record.Resource_Used} > ${record.Predefined_Limit} = ${isLimitExceeded}`);
    fs.appendFileSync('log.txt', `Comparing usage to limit: ${record.Resource_Used} > ${record.Predefined_Limit} = ${isLimitExceeded}\n`);
    return {
      StatusID: record.Status_ID,
      TestTypeID: record.Test_Type_ID,
      Date: record.Date,
      Hour: record.Hour,
      UserID: record.User_ID,
      ResourceTypeID: record.Resource_Type_ID,
      ResourceTypeName: record.Resource_Type_Name,
      ResourceUsed: record.Resource_Used,
      PredefinedLimit: record.Predefined_Limit,
      IsLimitExceeded: isLimitExceeded,
    };
  });
}

function parsePredefinedLimits(predefinedLimits) {
  return predefinedLimits.map(limit => {
    const resourceIDs = limit.Applied_Resources_ID_List.split(',');
    const resourceValues = limit.Applied_Resources_Limit_Values_List.split(',');
    let parsedLimits = {};

    resourceIDs.forEach((id, index) => {
      parsedLimits[id] = parseFloat(resourceValues[index]);
    });

    return {
      Predefined_Hourly_Limit_ID: limit.Predefined_Hourly_Limit_ID,
      Predefined_Hourly_Limit_Name: limit.Predefined_Hourly_Limit_Name,
      Trigger_Hours_List: limit.Trigger_Hours_List,
      Parsed_Limits: parsedLimits
    };
  });
}

module.exports = {
  resourceUsageOfHourTests,
  compareUsageToLimit,
};