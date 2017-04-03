SELECT TOP 50
      SUM(qs.total_worker_time) AS total_cpu_time,
      SUM(qs.execution_count) AS total_execution_count,
      COUNT(*) AS  number_of_statements,
      qs.sql_handle
FROM sys.dm_exec_query_stats AS qs
GROUP BY qs.sql_handle
ORDER BY SUM(qs.total_worker_time) DESC
