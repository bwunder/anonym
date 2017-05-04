SELECT
      total_cpu_time,
      total_execution_count,
      number_of_statements,
      s2.text
FROM
      (SELECT TOP 50
            SUM(qs.total_worker_time) AS total_cpu_time,
            SUM(qs.execution_count) AS total_execution_count,
            COUNT(*) AS  number_of_statements,
            qs.sql_handle --,
            --MIN(statement_start_offset) AS statement_start_offset,
            --MAX(statement_end_offset) AS statement_end_offset
      FROM
            sys.dm_exec_query_stats AS qs
      GROUP BY qs.sql_handle
      ORDER BY SUM(qs.total_worker_time) DESC) AS stats
      CROSS APPLY sys.dm_exec_sql_text(stats.sql_handle) AS s2
