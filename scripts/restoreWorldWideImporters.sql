USE [master]
RESTORE FILELISTONLY 
FROM disk= '/var/opt/anonym/backup/WorldWideImporters_FULL.bak'
--RESTORE DATABASE WorldWideImporters
--FROM disk= '/var/opt/mssql/backup/WorldWideImporters_FULL.bak'
--WITH MOVE 'AdventureWorks2014_data' TO 
--'/var/opt/mssql/data AdventureWorks2014.mdf',
--MOVE 'AdventureWorks2014_Log' TO '/var/opt/mssql/data/--AdventureWorks2014.ldf'
--,REPLACE
