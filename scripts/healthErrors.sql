SELECT CAST(xet.target_data as XML) as XMLData
  INTO #RingBufferData
  FROM sys.dm_xe_session_targets xet INNER JOIN
       sys.dm_xe_sessions xe ON (xe.address = xet.event_session_address)
WHERE xe.name = 'system_health'
SELECT e.query('.').value('(/event/@timestamp)[1]', 'datetime') as "TimeStamp",
       e.query('.').value('(/event/data/value)[1]', 'int') as "Number",
    e.query('.').value('(/event/data/value)[2]', 'int') as "Severity",
    e.query('.').value('(/event/data/value)[3]', 'int') as "State",
    e.query('.').value('(/event/data/value)[5]', 'varchar(max)') as "Message"
 FROM  #RingBufferData CROSS APPLY
       XMLData.nodes('/RingBufferTarget/event') AS Event(e)
 WHERE e.query('.').value('(/event/@name)[1]', 'varchar(255)') = 'error_reported'
   AND e.query('.').value('(/event/@timestamp)[1]', 'datetime') > GETDATE()-1

DROP TABLE #RingBufferData
