WITH CLRAppDomainCte
AS (
        -- select & run this query for a list of records in the queue
    SELECT ROW_NUMBER() OVER
( ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                       , Buffer.Record.value( '@id'
                                            , 'INT' ) ) AS [RowNumber]
         , Data.ring_buffer_type AS [Type]
         , Buffer.Record.value( 'Action[1]', 'NVARCHAR(128)') AS [Action]
         , Buffer.Record.value( 'AppDomain[1]/@dbid'
                              , 'INT') AS [AppDomainDbId]
         , Buffer.Record.value( 'AppDomain[1]/@ownerid '
                              , 'INT') AS [AppDomainOwnerId]
         , Buffer.Record.value( 'AppDomain[1]/@type'
                              , 'NVARCHAR(128)') AS [AppDomainType]
         , Buffer.Record.value( '(AppDomain/State)[1]'
                              , 'NVARCHAR(128)') AS [AppDomainState]
         , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
         , Buffer.Record.value('@id', 'INT') AS [Id]
         , Data.EventXML
    FROM (SELECT CAST(b.Record AS XML) AS EventXML
               , b.ring_buffer_type
          FROM sys.dm_os_ring_buffers AS b
          WHERE ring_buffer_type = 'RING_BUFFER_CLRAPPDOMAIN') AS Data
    CROSS APPLY Data.EventXML.nodes('//Record') AS Buffer(Record)
   )
SELECT first.[Type]
     , summary.[Action]
     , summary.[count]
     , DATEADD( SECOND
              ,( first.[time] - info.ms_ticks ) / 1000
              , CURRENT_TIMESTAMP ) AS [FirstTime]
     , DATEADD( SECOND
               ,( last.[time] - info.ms_ticks ) / 1000
               , CURRENT_TIMESTAMP ) AS [LastTime]
--     , first.EventXML AS [FirstRecord]
--     , last.EventXML AS [LastRecord]
FROM (SELECT [Action]
           , COUNT( RowNumber ) AS [count]
           , MIN( RowNumber ) AS [FirstRow]
           , MAX( RowNumber ) AS [LastRow]
      FROM CLRAppDomainCte
      GROUP BY [Action] ) AS summary
JOIN CLRAppDomainCte AS first
ON first.RowNumber = summary.[FirstRow]
JOIN CLRAppDomainCte AS last
ON last.RowNumber = summary.[LastRow]
CROSS JOIN sys.dm_os_sys_info AS info
ORDER BY [Action];
