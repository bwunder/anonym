WITH HOBTSchemaMgrCte
AS (
        -- run this query to list records in the queue
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value( 'operation[1]/@action' , 'NVARCHAR(128)') AS [Action]
         , Buffer.Record.value( 'operation[1]/@dbid' , 'INT') AS [DbId]
         , Buffer.Record.value( 'operation[1]/@version', 'INT' ) AS [Version]
         , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value( '@id', 'BIGINT' ) AS [Id]
         , Data.EventXML
    FROM (SELECT CAST(Record AS XML) AS EventXML
               , ring_buffer_type
          FROM sys.dm_os_ring_buffers
          WHERE ring_buffer_type = 'RING_BUFFER_HOBT_SCHEMAMGR') AS Data
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
   )
SELECT first.[Type]
     , summary.[DbId]
     , DB_NAME(summary.[DbId]) AS DbName
              , summary.[count]
     , DATEADD( second
               , first.[Time] - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [FirstTime]
     , DATEADD( second
               , last.[Time] - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [LastTime]
--     , first.EventXML AS [FirstRecord]
--     , last.EventXML AS [LastRecord]
FROM (SELECT [DbId]
           , COUNT(*) AS [count]
           , MIN([RowNumber]) AS [FirstRow]
           , MAX([RowNumber]) AS [LastRow]
       FROM HOBTSchemaMgrCte
       GROUP BY [DbId] ) AS summary
JOIN HOBTSchemaMgrCte AS first
ON first.RowNumber = summary.[FirstRow]
JOIN HOBTSchemaMgrCte AS last
ON last.RowNumber = summary.[LastRow]
CROSS JOIN sys.dm_os_sys_info AS info
ORDER BY DbId;
