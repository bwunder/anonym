WITH ExceptionCte
AS (
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value('(Exception/Error)[1]', 'int') AS [Error]
         , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value('@id', 'int') AS [Id]
         , Data.EventXML
    FROM (SELECT CAST(Record AS XML) AS EventXML
               , ring_buffer_type
          FROM sys.dm_os_ring_buffers
          WHERE ring_buffer_type = 'RING_BUFFER_EXCEPTION') AS Data
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
   )
SELECT first.[Type]
     , summary.[Error]
     , CASE WHEN msg.message_id IS NOT NULL
            THEN msg.text
            ELSE 'no sys.messages row for Error'
            END AS [External Message Info]
     , summary.[count]
     , DATEADD( second
               , first.[Time] - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [FirstTime]
     , DATEADD( second
               , last.[Time]  - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [LastTime]
--     , first.EventXML AS [FirstRecord]
--     , last.EventXML AS [LastRecord]
FROM (SELECT [Error]
            , COUNT(*) AS [count]
            , MIN(RowNumber) AS [FirstRow]
            , MAX(RowNumber) AS [LastRow]
       FROM ExceptionCte
       GROUP BY [Error] ) AS [summary]
JOIN ExceptionCTE AS first
ON first.RowNumber = summary.[FirstRow]
JOIN ExceptionCTE AS last
ON last.RowNumber = summary.[LastRow]
LEFT JOIN sys.messages msg
ON summary.Error = msg.message_id
AND msg.language_id = 1033
CROSS JOIN sys.dm_os_sys_info AS info
ORDER BY [Error];
