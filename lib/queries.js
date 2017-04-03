"use strict;"
module.exports = {

  getVersion:`select @@VERSION AS [SQL Server version];`,

  getDMVList:`SELECT name
    FROM sys.system_objects
    WHERE name LIKE 'dm_%'
    ORDER BY name`,

  memoryProfile:`select
      cpu_count,
      hyperthread_ratio,
      scheduler_count,
      physical_memory_kb,
      virtual_memory_kb,
      committed_kb,
      committed_target_kb,
      visible_target_kb
    from sys.dm_os_sys_info`,

  getTraceName:`SELECT
    SUBSTRING(
      REPLACE(
        t.[path] , CHAR(92), CHAR(47) )
      , CHARINDEX( ':', t.[path] ) + 1, LEN( t.[path] ) ) AS [Default Trace]
    FROM sys.traces t
    WHERE t.[is_default] = 1;`,

  getBlockers:`SELECT blocking_session_id
      , wait_duration_ms
      , session_id
    from sys.dm_os_waiting_tasks
    where blocking_session_id is not null`,

  dmLinuxStats: 'SELECT * FROM sys.dm_linux_proc_all_stat;',
  dmLinuxCPU: `SELECT * FROM sys.dm_linux_proc_cpuinfo;`,
  dmLinuxMem: `SELECT * FROM sys.dm_linux_proc_meminfo;`,
  dmLinuxMaps: `SELECT * FROM sys.dm_linux_proc_sql_maps;
    SELECT COUNT(*) AS [TotalRows] FROM sys.dm_linux_proc_sql_maps;`,
  dmLinuxSQLThreads: `SELECT TOP(2) * FROM sys.dm_linux_proc_sql_threads;
    SELECT COUNT(*)  AS [TotalRows] FROM sys.dm_linux_proc_sql_threads;`

}
