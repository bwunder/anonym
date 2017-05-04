/*
SELECT TOP 50
total_worker_time/execution_count AS [Avg CPU Time],
(SELECT SUBSTRING(text,
                  statement_start_offset/2,
                  (CASE WHEN statement_end_offset = -1
                        THEN LEN(CONVERT(nvarchar(max), text)) * 2
                        ELSE statement_end_offset END -statement_start_offset)/2)
  FROM sys.dm_exec_sql_text(sql_handle)) AS [query_text],
      *
FROM sys.dm_exec_query_stats
ORDER BY [Avg CPU Time] DESC
*/

SELECT TOP 5 CONVERT(varchar(128), query_stats.query_hash, 2) AS "Query Hash",
    SUM(query_stats.total_worker_time) / SUM(query_stats.execution_count) AS "Avg CPU Time",
    MIN(query_stats.statement_text) AS "Statement Text"
FROM
    (SELECT QS.*,
    SUBSTRING(ST.text, (QS.statement_start_offset/2) + 1,
    ((CASE statement_end_offset
        WHEN -1 THEN DATALENGTH(ST.text)
        ELSE QS.statement_end_offset END
            - QS.statement_start_offset)/2) + 1) AS statement_text
     FROM sys.dm_exec_query_stats AS QS
     CROSS APPLY sys.dm_exec_sql_text(QS.sql_handle) as ST) as query_stats
GROUP BY query_stats.query_hash
ORDER BY 2 DESC;
