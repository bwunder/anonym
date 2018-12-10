  if @@OPTIONS=0
    SELECT 'The Client takes precidence over these server defaults in sys.configurations: exec sp_configure "user options"' 
  IF (@@OPTIONS&1)=1  
    SELECT 'DISABLE_DEF_CNST_CHK Controls interim or deferred constraint checking.'
  IF (@@OPTIONS&2)=2
    SELECT 'IMPLICIT_TRANSACTIONS', 'For dblib network library connections, controls whether a transaction is started implicitly when a statement is executed. The IMPLICIT_TRANSACTIONS setting has no effect on ODBC or OLEDB connections.'
  IF (@@OPTIONS&4)=4 
    SELECT 'CURSOR_CLOSE_ON_COMMIT', 'Controls behavior of cursors after a commit operation has been performed.'
  IF (@@OPTIONS&8)=8 
    SELECT 'ANSI_WARNINGS', 'Controls truncation and NULL in aggregate warnings.'
  IF (@@OPTIONS&16)=16 
    SELECT 'ANSI_PADDING', 'Controls padding of fixed-length variables.'
  IF (@@OPTIONS&32)=32 
    SELECT 'ANSI_NULLS', 'Controls NULL handling when using equality operators.'
  IF (@@OPTIONS&64)=64 
    SELECT 'ARITHABORT', 'Terminates a query when an overflow or divide-by-zero error occurs during query execution.'
  IF (@@OPTIONS&128)=128 
    SELECT 'ARITHIGNORE', 'Returns NULL when an overflow or divide-by-zero error occurs during a query.'
  IF (@@OPTIONS&256)=256 
    SELECT 'QUOTED_IDENTIFIER', 'Differentiates between single and double quotation marks when evaluating an expression.'
  IF (@@OPTIONS&512)=512 
    SELECT 'NOCOUNT', 'Turns off the message returned at the end of each statement that states how many rows were affected.'
  IF (@@OPTIONS&1024)=1024 
    SELECT 'ANSI_NULL_DFLT_ON', 'Alters the session behavior to use ANSI compatibility for nullability. New columns defined without explicit nullability are defined to allow nulls.'
  IF (@@OPTIONS&2048)=2048 
    SELECT 'ANSI_NULL_DFLT_OFF', 'Alters the session behavior not to use ANSI compatibility for nullability. New columns defined without explicit nullability do not allow nulls.'
  IF (@@OPTIONS&4096)=4096 
    SELECT 'CONCAT_NULL_YIELDS_NULL', 'Returns NULL when concatenating a NULL value with a string.'
  IF (@@OPTIONS&8192)=8192 
    SELECT 'NUMERIC_ROUNDABORT', 'Generates an error when a loss of precision occurs in an expression.'
  IF (@@OPTIONS&16384)=16384 
    SELECT 'XACT_ABORT', 'Rolls back a transaction if a Transact-SQL statement raises a run-time error.'
