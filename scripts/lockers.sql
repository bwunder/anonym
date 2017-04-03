--
-- The pair matching targets report current unpaired events using
-- the sys.dm_xe_session_targets dynamic management view (DMV)
-- in XML format.
-- The following query retrieves the data from the DMV and stores
-- key data in a temporary table to speed subsequent access and
-- retrieval.
--
SELECT
objlocks.value('(action[@name="session_id"]/value)[1]', 'int')
        AS session_id,
    objlocks.value('(data[@name="database_id"]/value)[1]', 'int')
        AS database_id,
    objlocks.value('(data[@name="resource_type"]/text)[1]', 'nvarchar(50)' )
        AS resource_type,
    objlocks.value('(data[@name="resource_0"]/value)[1]', 'bigint')
        AS resource_0,
    objlocks.value('(data[@name="resource_1"]/value)[1]', 'bigint')
        AS resource_1,
    objlocks.value('(data[@name="resource_2"]/value)[1]', 'bigint')
        AS resource_2,
    objlocks.value('(data[@name="mode"]/text)[1]', 'nvarchar(50)')
        AS mode,
    objlocks.value('(action[@name="sql_text"]/value)[1]', 'varchar(MAX)')
        AS sql_text,
    CAST(objlocks.value('(action[@name="plan_handle"]/value)[1]', 'varchar(MAX)') AS xml)
        AS plan_handle,
    CAST(objlocks.value('(action[@name="tsql_stack"]/value)[1]', 'varchar(MAX)') AS xml)
        AS tsql_stack
INTO #unmatched_locks
FROM (
    SELECT CAST(xest.target_data as xml)
        lockinfo
    FROM sys.dm_xe_session_targets xest
    JOIN sys.dm_xe_sessions xes ON xes.address = xest.event_session_address
    WHERE xest.target_name = 'pair_matching' AND xes.name = 'FindBlockers'
) heldlocks
CROSS APPLY lockinfo.nodes('//event[@name="lock_acquired"]') AS T(objlocks)

--
-- Join the data acquired from the pairing target with other
-- DMVs to return provide additional information about blockers
--
SELECT ul.*
    FROM #unmatched_locks ul
    INNER JOIN sys.dm_tran_locks tl ON ul.database_id = tl.resource_database_id AND ul.resource_type = tl.resource_type
    WHERE resource_0 IS NOT NULL
    AND session_id IN
        (SELECT blocking_session_id FROM sys.dm_exec_requests WHERE blocking_session_id != 0)
    AND tl.request_status='wait'
    AND REPLACE(ul.mode, 'LCK_M_', '' ) = tl.request_mode;
