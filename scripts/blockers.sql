DECLARE @sql nvarchar(1024)
IF EXISTS(SELECT * FROM sys.server_event_sessions WHERE name='FindBlockers')
    EXEC ('DROP EVENT SESSION FindBlockers ON SERVER')

SET @sql = N'
CREATE EVENT SESSION FindBlockers ON SERVER
ADD EVENT sqlserver.lock_acquired
    (action
        ( sqlserver.sql_text, sqlserver.database_id, sqlserver.tsql_stack,
         sqlserver.plan_handle, sqlserver.session_id)
    WHERE ( resource_0!=0)
    ),
ADD EVENT sqlserver.lock_released
    (WHERE ( resource_0!=0 ))
ADD TARGET package0.pair_matching
    ( SET begin_event="sqlserver.lock_acquired",
            begin_matching_columns="database_id, resource_0, resource_1, resource_2, transaction_id, mode",
            end_event="sqlserver.lock_released",
            end_matching_columns="database_id, resource_0, resource_1, resource_2, transaction_id, mode",
    respond_to_memory_pressure=1)
WITH (max_dispatch_latency = 1 seconds)'

EXEC (@sql)

ALTER EVENT SESSION FindBlockers ON SERVER
STATE = START;
