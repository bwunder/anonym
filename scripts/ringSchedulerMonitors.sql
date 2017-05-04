--WITH SchedulerMonitorCte
--AS (
        -- select & run this query for a list of records in the queue
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'bigint') AS [ProcessUtilization]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'bigint') AS [SystemIdle]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/UserModeTime)[1]', 'bigint') AS [UserModeTime]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/KernelModeTime)[1]', 'bigint') AS [KernelModeTime]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/PageFaults)[1]', 'bigint') AS [PageFaults]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/WorkingSetDelta)[1]', 'bigint') AS [WorkingSetDelta]
         , Buffer.Record.value('(SchedulerMonitorEvent/SystemHealth/MemoryUtilization)[1]', 'bigint') AS [MemoryUtilization]
                            , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value('@id', 'int') AS [Id]
--         , Data.EventXML
    FROM ( SELECT CAST(Record AS XML) AS EventXML
                , ring_buffer_type
           FROM sys.dm_os_ring_buffers
           WHERE ring_buffer_type = 'RING_BUFFER_SCHEDULER_MONITOR') AS Data
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
/*
   )
SELECT first.[Type]
     , summary.[Count]
     , DATEADD( second
               , first.[Time] - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [FirstTime]
     , DATEADD( second
               , last.[Time] - info.ms_ticks / 1000
               , CURRENT_TIMESTAMP ) AS [LastTime]
--     , first.EventXML AS [FirstRecord]
--     , last.EventXML AS [LastRecord]
FROM ( SELECT COUNT(RowNumber) AS [count]
            , MIN(RowNumber) AS [FirstRow]
            , MAX(RowNumber) AS [LastRow]
       FROM SchedulerMonitorCte ) AS summary
JOIN SchedulerMonitorCte AS first
ON first.RowNumber = summary.[FirstRow]
JOIN SchedulerMonitorCte AS last
ON last.RowNumber = summary.[LastRow]
CROSS JOIN sys.dm_os_sys_info AS info;
*/
