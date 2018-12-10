module.exports = {
  badSyntax: `SELETC @@OPTIONS AS [@@OPTIONS]`,
  clusterAlwaysOn: `
    SELECT cluster_name,
           quorum_type_desc,
           quorum_state_desc
    FROM sys.dm_hadr_cluster
  `,
  clusterNodes: `
    SELECT NodeName,
           status_description,
           is_current_owner
    FROM sys.dm_os_cluster_nodes 
  `,
  configurations: `
    SELECT name,
           value,
           value_in_use,
           minimum,
           maximum,
           [description],
           is_dynamic,
           is_advanced
    FROM sys.configurations
    ORDER BY name
  `,
  databases: `
    SELECT [database_id], [name] AS [Database Name]
    FROM sys.databases
    ORDER BY [name]
  `,
  dbFiles: `
    SELECT DB_NAME([database_id]) AS [Database Name],
           [file_id],
           [name],
           physical_name,
           [type_desc],
           state_desc,
           is_percent_growth,
           growth,
           CONVERT(bigint, growth/128.0) AS [Growth in MB],
           CONVERT(bigint, size/128.0) AS [Total Size in MB]
    FROM sys.master_files WITH (NOLOCK)
    ORDER BY DB_NAME([database_id]),
             [file_id]
  `,
  dmvs: `
    SELECT name,
           type,
           type_desc
    FROM sys.system_objects
    WHERE name LIKE 'dm_%'
    ORDER BY name
  `,
  functions: `
    SELECT FORMATMESSAGE('%s.%s', routine_schema, routine_name) AS [functions]
      FROM information_schema.routines
      WHERE routine_type = 'FUNCTION'
      AND routine_catalog = DB_NAME()
  `,
  linkedServers: `
    SELECT name AS [SQLServer], 
      DB_NAME() AS [Database], 
      data_source, 
      is_linked 
    FROM master.sys.servers
  `,
  memoryAvailable: `
    SELECT total_physical_memory_kb/1024 AS [Physical Memory (MB)],
           available_physical_memory_kb/1024 AS [Available Memory (MB)],
           total_page_file_kb/1024 AS [Total Page File (MB)],
           available_page_file_kb/1024 AS [Available Page File (MB)],
           system_cache_kb/1024 AS [System Cache (MB)],
           system_memory_state_desc AS [System Memory State]
    FROM sys.dm_os_sys_memory
  `,
  memoryDumps: `
    SELECT [filename], creation_time, size_in_bytes/1048576.0 AS [Size (MB)]
    FROM sys.dm_server_memory_dumps WITH (NOLOCK)
    ORDER BY creation_time DESC OPTION (RECOMPILE)
  `,
  memoryInfo: `
    SELECT cpu_count, hyperthread_ratio, scheduler_count, physical_memory_kb,
      virtual_memory_kb, committed_kb, committed_target_kb, visible_target_kb
    FROM sys.dm_os_sys_info
  `,
  memoryProcess: `
    SELECT physical_memory_in_use_kb/1024 AS [SQL Server Memory Usage (MB)],
      large_page_allocations_kb, locked_page_allocations_kb, page_fault_count,
        memory_utilization_percentage, available_commit_limit_kb,
        process_physical_memory_low, process_virtual_memory_low
    FROM sys.dm_os_process_memory WITH (NOLOCK) OPTION (RECOMPILE)
  `,
  ringBuffers: `SELECT [ring_buffer_type]
      , ISNULL( COUNT(buffer.[ring_buffer_type] ), 0 ) AS [type_count]
    FROM sys.dm_os_ring_buffers buffer
    CROSS JOIN sys.dm_os_sys_info info
    GROUP BY [ring_buffer_type]
  `,
  procedures: `
    SELECT FORMATMESSAGE('%s.%s', routine_schema, routine_name) AS [procedure]
    FROM information_schema.routines
    WHERE routine_type = 'PROCEDURE'
    AND routine_catalog = DB_NAME()
  `,
  version: `
    SELECT @@SERVERNAME AS [Server Name],
           @@VERSION AS [Version]
  `,
  services: `
    SELECT servicename, process_id, startup_type_desc, status_desc,
      last_startup_time, service_account, is_clustered, cluster_nodename, [filename]
    FROM sys.dm_server_services WITH (NOLOCK) OPTION (RECOMPILE)
  `,
  advancedOptions: `
    EXEC sp_configure 'show advanced options', '1'
    RECONFIGURE
    EXEC sp_configure
  `,
  tables: `
    SELECT FORMATMESSAGE('%s.%s', table_schema, table_name) AS [table]
    FROM information_schema.tables
    WHERE table_type = 'TABLE'
    AND table_catalog = DB_NAME()
  `,
  trace: `
    SELECT SUBSTRING( REPLACE( t.[path] , CHAR(92), CHAR(47) ),
      CHARINDEX( ':', t.[path] ) + 1, LEN( t.[path] ) ) AS [Default Trace]
      FROM sys.traces t
      WHERE t.[is_default] = 1
  `,
  views: `
    SELECT FORMATMESSAGE('%s.%s', table_schema, table_name) AS [view]
    FROM information_schema.tables
    WHERE table_type = 'VIEW'
    AND table_catalog = DB_NAME()
  `
}