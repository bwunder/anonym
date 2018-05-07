SELECT FORMATMESSAGE('%s-%s %s',cat.name, evt.name, ISNULL( sub.subclass_name, 'n/a')) AS [Event]
		 , COALESCE( trc.DatabaseName, DB_NAME(trc.DatabaseID), 'n/a' ) as [Database]
		 , COALESCE( SUSER_SNAME(trc.LoginSid), trc.NtUserName, 'n/a' ) AS [Login]
     , ISNULL( trc.ApplicationName, 'n/a') As Application
     , trc.StartTime
     , ISNULL( trc.HostName, 'n/a') AS Host
     , ISNULL( type.ObjectType, '' ) AS ObjType
     , ISNULL( 'Severity: ' + CAST( trc.Severity AS NCHAR(4) ), '' ) 
     + ISNULL( 'State: ' + CAST( trc.State AS NCHAR(4) ), '' ) 
     + ISNULL( 'Line: ' + CAST( trc.LineNumber AS NVARCHAR(11) ), '' ) 
     + ISNULL( ' Error: ' + CAST( trc.Error AS NCHAR(11) ) + CRLF, '' )
     + ISNULL( 'TextData: ' + CAST( trc.TextData AS NVARCHAR(MAX) ) + CRLF, '')
     + ISNULL( 'Parent Object: ' + trc.ParentName + CRLF, '' )
     + ISNULL( CASE WHEN trc.EventClass = 55 
                    THEN 'Plan Node: ' ELSE 'Object Id: ' END
               + CAST( trc.ObjectId AS NVARCHAR(11) ) + CRLF, '')
     + ISNULL( 'Object: ' + ISNULL( OBJECT_SCHEMA_NAME( trc.ObjectId, trc.DatabaseId ) + '.', '' )
     + ISNULL(trc.ObjectName, OBJECT_NAME( trc.ObjectId, trc.DatabaseId ) ) + CRLF, '')
     + ISNULL( 'IndexId: ' + CAST( trc.IndexId AS NCHAR(11) ) + BLANK + CRLF, '' )
     + CASE WHEN trc.Permissions IS NOT NULL
            THEN 'Permissions Checked: ' 
                + CASE WHEN trc.Permissions & 1 = 1 
                       THEN TAB + N'SELECT ALL' + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 2 = 2 
                       THEN TAB + N'UPDATE ALL'  + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 4 = 4 
                       THEN TAB + N'REFERENCES ALL' + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 8 = 8 
                       THEN TAB + N'INSERT' + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 16 = 16 
                       THEN TAB + N'DELETE'  + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 32 = 32 
                       THEN TAB + N'EXECUTE'  + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 4096 = 4096 
                       THEN TAB + N'SELECT ANY' + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 8192 = 8192 
                       THEN TAB + N'UPDATE ANY' + CRLF 
                       ELSE BLANK END 
                + CASE WHEN trc.Permissions & 16384 = 16384 
                       THEN TAB + N'REFERENCES ANY' + CRLF 
                       ELSE BLANK END 
            ELSE ''
            END 
+ ISNULL( 'SPID: ' + CAST(trc.SPID AS NCHAR(10)) + CRLF, '')
+ ISNULL( 'PID: ' + CAST(trc.ClientProcessId AS NCHAR(10)) + CRLF, '') AS [ExtendedInfo]
FROM sys.traces t
CROSS APPLY sys.fn_trace_gettable( LEFT( t.[path]
                                       , LEN(t.[path]) - PATINDEX( '%/%'
                                       , REVERSE(t.[path]) ) )  + '/log.trc'
                                 , DEFAULT ) As trc 
INNER JOIN sys.trace_events evt
ON trc.EventClass = evt.trace_event_id
CROSS JOIN ( SELECT CHAR(10) + CHAR(13) AS [CRLF]
            , CHAR(32) AS [BLANK]
            , CHAR(9) AS [TAB] ) AS sym
INNER JOIN sys.trace_categories cat
ON evt.category_id = cat.category_id
LEFT JOIN sys.trace_subclass_values AS sub
ON trc.EventClass = sub.trace_event_id
AND trc.EventSubClass = sub.subclass_value 
LEFT JOIN ( SELECT DISTINCT sub.subclass_name AS ObjectType
                          , sub.subclass_value 
            FROM sys.trace_events AS evt 
            JOIN sys.trace_subclass_values AS sub 
            ON evt.trace_event_id = sub.trace_event_id 
            JOIN sys.trace_columns AS col 
            ON sub.trace_column_id = col.trace_column_id 
            WHERE col.[name] = 'ObjectType' ) AS type
ON trc.ObjectType = type.subclass_value
WHERE t.is_default = 1
AND trc.StartTime BETWEEN GETDATE() - 1 AND GETDATE()
ORDER BY StartTime;