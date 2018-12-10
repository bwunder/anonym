/****************************************************************
* Verify intra-container query infrastruture
* requires two running SQL Server containers on host
* get the IPs from the anonym CLI "catalog network" command
* or by  
* cleanup
if (SELECT is_linked from sys.servers where name = @SERVER_B)
  EXEC master.dbo.sp_dropserver @SERVER_B
*****************************************************************/
DECLARE @SERVER NVARCHAR(128) = N'7f0f88b7d413'
      , @DataSource NVARCHAR(128) = N'172.17.0.4, 1433'
      , @Database NVARCHAR(128) = N'master'
      , @SQL NVARCHAR(256) = N'SELECT name AS [SQLServer], DB_NAME() AS [Database], is_linked FROM master.sys.servers'
BEGIN TRY 
  IF EXISTS (SELECT is_linked FROM sys.servers WHERE name = @SERVER)
    EXEC master.dbo.sp_dropserver @SERVER
  EXEC master.dbo.sp_addlinkedserver 
      @server = @SERVER
    , @srvproduct=N''
    , @provider=N'SQLNCLI'
    , @datasrc = @DataSource
    , @catalog = @Database
  EXEC master.dbo.sp_testlinkedserver @SERVER -- yawn
  SELECT * FROM OPENQUERY (@SERVER, @SQL)
END TRY  
BEGIN CATCH
  SELECT  
      ERROR_NUMBER() AS ErrorNumber  
    , ERROR_SEVERITY() AS ErrorSeverity  
    , ERROR_STATE() AS ErrorState  
    , ERROR_PROCEDURE() AS ErrorProcedure  
    , ERROR_LINE() AS ErrorLine  
    , ERROR_MESSAGE() AS ErrorMessage 
END CATCH
