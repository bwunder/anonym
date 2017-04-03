-- hard to make this fail if the connection is made 
SELECT @@SERVERNAME AS [SQL Server Name],
       DB_NAME() AS [database],
       ORIGINAL_LOGIN() AS [SQL Server Login],
       USER_NAME() AS [Database User];
