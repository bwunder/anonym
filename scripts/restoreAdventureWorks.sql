USE [master]
RESTORE DATABASE AdventureWorks2014
FROM disk= '/var/opt/mssql/backup/AdventureWorks2014.bak'
WITH MOVE 'AdventureWorks2014_data' TO '/var/opt/mssql/data/AdventureWorks2014.mdf',
MOVE 'AdventureWorks2014_Log' TO '/var/opt/mssql/data/AdventureWorks2014.ldf'
,REPLACE
