DECLARE @TargetDate DATE = '2024-07-26';
      DECLARE @TargetHour INT = 21;

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
              WHEN ru.[Resource_Type_ID] = 1 THEN 200 WHEN ru.[Resource_Type_ID] = 2 THEN 343 WHEN ru.[Resource_Type_ID] = 3 THEN 700 WHEN ru.[Resource_Type_ID] = 4 THEN 555
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
                  WHEN ru.[Resource_Type_ID] = 1 THEN 200 WHEN ru.[Resource_Type_ID] = 2 THEN 343 WHEN ru.[Resource_Type_ID] = 3 THEN 700 WHEN ru.[Resource_Type_ID] = 4 THEN 555
                  ELSE 0
              END
          );