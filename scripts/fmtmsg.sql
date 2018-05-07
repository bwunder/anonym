-- printf formatting  %[[flag][width][.precision]]type
DECLARE @Format CHAR(1)         = ''   -- '',+,-,0,#,' '
      , @Width INT              = 6    -- display field size
      , @Precision INT          = 3    -- characters to display
      , @Type CHAR(1)           = 'X'  -- s, d, i, u, o, x, X
      , @Binary VARBINARY(128)  = 0x1239 
      , @Int INT                = 11                
      , @String NVARCHAR(128)   = N'test';  
DECLARE @$QL NVARCHAR(256) = ( SELECT FORMATMESSAGE( 
N'SELECT FORMATMESSAGE(''%%s -->%%%s*.*%s<--'', @$QL, %i, %i, %s)'
                      , s.Flag 
                      , f.Type
                      , @Width
                      , @Precision 
                      , CASE WHEN @Type = 's' 
                             THEN FORMATMESSAGE('''%s''', @String)
                             WHEN @Type = 'd'
                             THEN FORMATMESSAGE('%d', @Int)
                             WHEN @Type = 'i'
                             THEN FORMATMESSAGE('%i', @Int)
                             WHEN @Type = 'u'
                             THEN FORMATMESSAGE('%u', @Int)
                             WHEN @Type = 'o'
                             THEN FORMATMESSAGE('%o', @Int)
                             WHEN @Type = 'x'
                             THEN FORMATMESSAGE('%x', @Binary)
                             WHEN @Type = 'X'
                             THEN FORMATMESSAGE('%X', @Binary)
                             END )
   FROM (SELECT           ('') AS Flag
         UNION ALL SELECT ('+') 
         UNION ALL SELECT ('-') 
         UNION ALL SELECT ('0') 
         UNION ALL SELECT ('#') 
         UNION ALL SELECT (' ') ) AS s      
   CROSS JOIN (SELECT           ('s') AS Type
               UNION ALL SELECT ('d')
               UNION ALL SELECT ('i')
               UNION ALL SELECT ('u')
               UNION ALL SELECT ('o')
               UNION ALL SELECT (LOWER('x'))
               UNION ALL SELECT (UPPER('X')) ) as f
   WHERE CHARINDEX(@Format,s.Flag) > 0
   AND ASCII(f.Type) = ASCII(@Type) );
EXEC sp_executesql @$QL, N'@$QL NVARCHAR(256)', @$QL;
