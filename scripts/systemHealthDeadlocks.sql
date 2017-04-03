-- Fetch the Health Session data into a temporary table
SELECT CAST(xet.target_data AS XML) AS XMLDATA
INTO #SystemHealthSessionData
FROM sys.dm_xe_session_targets xet
JOIN sys.dm_xe_sessions xe
ON (xe.address = xet.event_session_address)
WHERE xe.name = 'system_health'
-- Gets the Deadlock Event Time and Victim Process
SELECT C.query('.').value('(/event/@timestamp)[1]', 'datetime') as EventTime,
CAST(C.query('.').value('(/event/data/value)[1]', 'varchar(MAX)') AS XML).value('(<a>/deadlock/victim-list/victimProcess/@id)[1]','varchar(100)'</a>) VictimProcess
FROM #SystemHealthSessionData a
CROSS APPLY a.XMLDATA.nodes('/RingBufferTarget/event') as T(C)
WHERE C.query('.').value('(/event/@name)[1]', 'varchar(255)') = 'xml_deadlock_report'
-- Drop the temporary table
DROP TABLE #SystemHealthSessionData
