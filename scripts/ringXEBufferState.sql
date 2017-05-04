WITH XEBufferStateCte
AS (
        -- select & run this query for a list of records in the queue
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value('(XE_BufferStateRecord/NewState)[1]', 'varchar(100)') as [NewState]
         , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value('@id', 'int') AS [Id]
         , Data.EventXML
    FROM (SELECT CAST(Record AS XML) AS EventXML
               , ring_buffer_type
          FROM sys.dm_os_ring_buffers
          WHERE ring_buffer_type =
'RING_BUFFER_XE_BUFFER_STATE'
) AS Data
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
   )
SELECT first.[Type]
      , summary.[NewState]
      , summary.[Count]
      , DATEADD( second
                , first.[Time] - info.ms_ticks / 1000
                , CURRENT_TIMESTAMP ) AS [FirstTime]
      , DATEADD( second
                , last.[Time] - info.ms_ticks / 1000
                , CURRENT_TIMESTAMP ) AS [LastTime]
--      , first.EventXML AS [FirstRecord]
--      , last.EventXML AS [LastRecord]
FROM (SELECT [NewState]
           , COUNT(*) AS [count]
           , MIN(RowNumber) AS [FirstRow]
           , MAX(RowNumber) AS [LastRow]
      FROM XEBufferStateCte
      GROUP BY [NewState] ) AS summary
JOIN XEBufferStateCte AS first
ON first.RowNumber = summary.[FirstRow]
JOIN XEBufferStateCte AS last
ON last.RowNumber = summary.[LastRow]
CROSS JOIN sys.dm_os_sys_info AS info
--ORDER BY [FirstTime];
ORDER BY [LastTime] DESC;
