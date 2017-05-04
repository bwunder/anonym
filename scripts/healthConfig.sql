SELECT s.name, t.execution_count, e.event_name
FROM sys.dm_xe_sessions AS s
JOIN sys.dm_xe_session_targets AS t
ON s.address = t.event_session_address
JOIN sys.dm_xe_session_events AS e
ON t.event_session_address = e.event_session_address
WHERE s.Name = 'system_health'
