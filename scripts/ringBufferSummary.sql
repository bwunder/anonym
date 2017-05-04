WITH BufferTypeCte
AS (
    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                     , Buffer.Record.value( '@id', 'INT' )
                                     , Data.[Address]
                                     , Data.[Type] ) AS [RowNumber]
          , Data.[Address]
          , Data.[Type]
          , DATEADD( SECOND, ( Buffer.Record.value( '@time', 'BIGINT' ) - Data.ms_ticks ) / 1000, GETDATE() ) AS [Time]
          , Buffer.Record.value('@id', 'INT') AS [Id]
          , Data.EventXML
    FROM (  SELECT CAST(b.Record AS XML) AS EventXML
             , b.ring_buffer_address AS [Address]
             , b.ring_buffer_type AS [Type]
             , i.ms_ticks
        FROM sys.dm_os_ring_buffers b
        CROSS JOIN sys.dm_os_sys_info i ) AS [Data]
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
  )
SELECT first.[Type]
     , summary.[count]
     , first.[Time] AS [FirstTime]
     , last.[Time] AS [LastTime]
--     , first.EventXML AS [FirstRecord]
--     , last.EventXML AS [LastRecord]
FROM (SELECT [Type]
           , COUNT( RowNumber ) AS [count]
           , MIN( RowNumber ) AS [FirstRow]
           , MAX( RowNumber ) AS [LastRow]
      FROM BufferTypeCTE
      GROUP BY [Type]
    ) AS summary
JOIN BufferTypeCTE AS first
ON first.RowNumber = summary.[FirstRow]
JOIN BufferTypeCTE AS last
ON last.RowNumber = summary.[LastRow]
--ORDER BY [FirstTime];
--ORDER BY [LastTime];
ORDER BY [Type];
