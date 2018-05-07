module.exports = {
  clusterAlwaysOn: `SELECT cluster_name, quorum_type_desc, quorum_state_desc
    FROM sys.dm_hadr_cluster WITH (NOLOCK) OPTION (RECOMPILE);`,
  clusterNodes: `SELECT NodeName, status_description, is_current_owner
    FROM sys.dm_os_cluster_nodes WITH (NOLOCK) OPTION (RECOMPILE);`,
  databases: `SELECT DB_NAME([database_id]) AS [Database Name], [file_id], [name],
      physical_name, [type_desc], state_desc, is_percent_growth, growth,
          CONVERT(bigint, growth/128.0) AS [Growth in MB],
      CONVERT(bigint, size/128.0) AS [Total Size in MB]
    FROM sys.master_files WITH (NOLOCK)
    ORDER BY DB_NAME([database_id]), [file_id] OPTION (RECOMPILE);`,
  managementViews: `SELECT name, type, type_desc
    FROM sys.system_objects
    WHERE name LIKE 'dm_%'
    ORDER BY name`,
  configurations: `SELECT name, value,
    value_in_use, minimum, maximum, [description], is_dynamic, is_advanced
    FROM sys.configurations WITH (NOLOCK)
    ORDER BY name OPTION (RECOMPILE);`,
  procedures: `SELECT routine_catalog, routine_schema, routine_name
    FROM information_schema.routines
    WHERE routine_type = 'PROCEDURE'
    AND routine_catalog = DB_NAME()`,
  sqlVersion: `SELECT @@SERVERNAME AS [@@SERVERNAME],
    @@VERSION AS [@@VERSION];`,
  memoryAvailable: `SELECT total_physical_memory_kb/1024 AS [Physical Memory (MB)],
      available_physical_memory_kb/1024 AS [Available Memory (MB)],
      total_page_file_kb/1024 AS [Total Page File (MB)],
          available_page_file_kb/1024 AS [Available Page File (MB)],
          system_cache_kb/1024 AS [System Cache (MB)],
      system_memory_state_desc AS [System Memory State]
    FROM sys.dm_os_sys_memory WITH (NOLOCK) OPTION (RECOMPILE);`,
  memoryDumps: `SELECT [filename], creation_time, size_in_bytes/1048576.0 AS [Size (MB)]
    FROM sys.dm_server_memory_dumps WITH (NOLOCK)
    ORDER BY creation_time DESC OPTION (RECOMPILE);`,
  memoryInfo:`SELECT cpu_count, hyperthread_ratio, scheduler_count, physical_memory_kb,
      virtual_memory_kb, committed_kb, committed_target_kb, visible_target_kb
    FROM sys.dm_os_sys_info`,
  memoryProcess: `SELECT physical_memory_in_use_kb/1024 AS [SQL Server Memory Usage (MB)],
      large_page_allocations_kb, locked_page_allocations_kb, page_fault_count,
        memory_utilization_percentage, available_commit_limit_kb,
        process_physical_memory_low, process_virtual_memory_low
    FROM sys.dm_os_process_memory WITH (NOLOCK) OPTION (RECOMPILE);`,
  serverServices: `SELECT servicename, process_id, startup_type_desc, status_desc,
      last_startup_time, service_account, is_clustered, cluster_nodename, [filename]
    FROM sys.dm_server_services WITH (NOLOCK) OPTION (RECOMPILE);`,
  traceName: `SELECT SUBSTRING( REPLACE( t.[path] , CHAR(92), CHAR(47) ),
      CHARINDEX( ':', t.[path] ) + 1, LEN( t.[path] ) ) AS [Default Trace]
      FROM sys.traces t
      WHERE t.[is_default] = 1;`,
  showAdvancedOptions: `EXEC sp_configure 'show advanced options', '1';
    RECONFIGURE;
    EXEC sp_configure;`,
  ringBuffers: `SELECT [ring_buffer_type]
      , ISNULL( COUNT(buffer.[ring_buffer_type] ), 0 ) AS [type_count]
    FROM sys.dm_os_ring_buffers buffer
    CROSS JOIN sys.dm_os_sys_info info
    GROUP BY [ring_buffer_type];`,
  traceStatus: `DBCC TRACESTATUS (-1);`
}
