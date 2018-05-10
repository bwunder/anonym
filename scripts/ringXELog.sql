    SELECT ROW_NUMBER() OVER (ORDER BY Buffer.Record.value( '@time', 'BIGINT' )
                                    , Buffer.Record.value( '@id', 'INT' ) ) AS [RowNumber]
        , Data.ring_buffer_type AS [Type]
        , Buffer.Record.value('(XE_LogRecord/@message)[1]', 'varchar(max)') AS [XE_LogRecord]
        , Buffer.Record.value( '@time', 'BIGINT' ) AS [time]
        , Buffer.Record.value('@id', 'int') AS [Id]
        , Data.EventXML
    FROM (SELECT CAST(Record AS XML) AS EventXML
                , ring_buffer_type
          FROM sys.dm_os_ring_buffers
          WHERE ring_buffer_type = 'RING_BUFFER_XE_LOG') AS Data
    CROSS APPLY EventXML.nodes('//Record') AS Buffer(Record)
