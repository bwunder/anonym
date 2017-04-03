select * from sys.dm_exec_query_optimizer_info
where
      counter = 'optimizations'
      or counter = 'elapsed time'
