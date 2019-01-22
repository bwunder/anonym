/****************************************************************
* Verify intra-container query infrastruture
* requires two running SQL Server containers on host
* get the IPs from the anonym CLI "catalog network" command
if (SELECT is_linked from sys.servers where name = @SERVER_B)
  EXEC master.dbo.sp_dropserver @SERVER_B
*****************************************************************/
DECLARE @Target NVARCHAR(128) = N'$(Target)'       --containerId
      , @DataSource NVARCHAR(128) = N'$(IP), 1433' --$(IP), $(port)
      , @Database NVARCHAR(128) = N'master'        --$(database)
      , @SQL NVARCHAR(256) = N'SELECT name AS [SQLServer], DB_NAME() AS [Database], is_linked FROM master.sys.servers'
BEGIN TRY 
  IF EXISTS (SELECT is_linked FROM sys.servers WHERE name = @Target)
    EXEC master.dbo.sp_dropserver @Target
  EXEC master.dbo.sp_addlinkedserver 
      @server = @Target
    , @srvproduct=N''
    , @provider=N'SQLNCLI'
    , @datasrc = @DataSource
    , @catalog = @Database
  EXEC master.dbo.sp_testlinkedserver @Target -- yawn
  SELECT * FROM OPENQUERY (@Target, @SQL)
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
