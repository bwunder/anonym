WITH SecurityErrorCte
AS (
           -- select & run this query for a list of records in the queue
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value( '(Error/SPID)[1]', 'INT' ) AS [SessionId]
         , Buffer.Record.value( '(Error/ErrorCode)[1]', 'NVARCHAR(128)' ) AS [ErrorCode]
         , Buffer.Record.value( '(Error/SQLErrorCode)[1]', 'NVARCHAR(128)' ) AS [SQLErrorCode]
         , Buffer.Record.value( '(Error/APIName)[1]', 'NVARCHAR(128)' ) AS [APIName]
         , Buffer.Record.value( '(Error/CallingAPIName)[1]', 'NVARCHAR(128)' ) AS [CallingAPIName]
                            , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value('@id', 'INT') AS [Id]
         , Data.EventXML
                     FROM (SELECT CAST(Record AS XML) AS EventXML
                                   , ring_buffer_type
                                  FROM sys.dm_os_ring_buffers
                                  WHERE ring_buffer_type = 'RING_BUFFER_SECURITY_ERROR') AS Data
                     CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
    )
  SELECT first.[Type]
       , summary.[ErrorCode]
       , summary.[SQLErrorCode]
       , summary.[APIName]
       , summary.[CallingAPIName]
       , summary.[Count]
       , DATEADD( second
                 , first.[Time] - info.ms_ticks / 1000
                 , CURRENT_TIMESTAMP ) AS [FirstTime]
       , DATEADD( second
                 , last.[Time] - info.ms_ticks / 1000
                 , CURRENT_TIMESTAMP ) AS [LastTime]
--       , first.EventXML AS [FirstRecord]
--       , last.EventXML AS [LastRecord]
  FROM ( SELECT [ErrorCode]
              , [SQLErrorCode]
              , [APIName]
              , [CallingAPIName]
              , COUNT(*) AS [count]
              , MIN(RowNumber) AS [FirstRow]
              , MAX(RowNumber) AS [LastRow]
         FROM SecurityErrorCte
         GROUP BY [ErrorCode]
                , [SQLErrorCode]
                , [APIName]
                , [CallingAPIName] ) AS summary
JOIN SecurityErrorCte AS first
ON first.RowNumber = summary.[FirstRow]
JOIN SecurityErrorCte AS last
ON last.RowNumber = summary.[LastRow]
CROSS JOIN sys.dm_os_sys_info AS info
ORDER BY [FirstTime];
--ORDER BY [LastTime] DESC;
