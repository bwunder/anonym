select top 5
    (total_logical_reads/execution_count) as avg_logical_reads,
    (total_logical_writes/execution_count) as avg_logical_writes,
    (total_physical_reads/execution_count) as avg_phys_reads,
     Execution_count,
    statement_start_offset as stmt_start_offset,
    sql_handle,
    plan_handle
from sys.dm_exec_query_stats
order by  (total_logical_reads + total_logical_writes) Desc;
