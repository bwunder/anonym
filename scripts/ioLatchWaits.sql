select wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms, wait_time_ms / waiting_tasks_count
from sys.dm_os_wait_stats
where wait_type like 'PAGEIOLATCH%'  and waiting_tasks_count > 0
order by wait_type
