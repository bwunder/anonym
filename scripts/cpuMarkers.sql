select *
from
      sys.dm_exec_cached_plans
      cross apply sys.dm_exec_query_plan(plan_handle)
where
      cast(query_plan as nvarchar(max)) like '%Sort%'
      or cast(query_plan as nvarchar(max)) like '%Hash Match%'
