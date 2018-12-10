--------------------------------------------------------------------------
-- Using FORMATMESSAGE to generate BACKUP CERTIFICATE STATEMENT
--------------------------------------------------------------------------
-- user defined table type for encrypted name/value pair
IF TYPE_ID('NAMEVALUETYPE') IS NULL
  CREATE TYPE NAMEVALUETYPE AS TABLE
      ( Name VARBINARY(8000) NOT NULL
      , Value VARBINARY(8000) NOT NULL );
GO
--temp key available to session only until session is closed
--not useful for persisted data unless source,identity & phrase persisted
IF KEY_GUID('#TestKey') is NULL
  CREATE SYMMETRIC KEY #TestKey 
  WITH ALGORITHM = AES_256 
     , KEY_SOURCE = 'testing 1,2,3'
     , IDENTITY_VALUE = 'This is only a test'
  ENCRYPTION BY PASSWORD = 'Test4hat$';   
OPEN SYMMETRIC KEY #TestKey DECRYPTION BY PASSWORD = 'Test4hat$';
GO
-- setup the required inputs
DECLARE @CertificateName NVARCHAR(128) = 'CertificateName'
      , @CipherType NCHAR(2) = 'MK' -- 'NA' (EKM), 'MK' , 'PW'
      , @DbName NVARCHAR(128) = 'DbName'
      , @BackupName VARBINARY(8000) = ENCRYPTBYKEY(key_guid('#TestKey')
                                                      , N'BackupName')     
      , @DMKPhraseName VARBINARY(8000) = ENCRYPTBYKEY(key_guid('#TestKey')
                                                      , N'DMKPhraseName')
      , @KeyPhraseName VARBINARY(8000) = ENCRYPTBYKEY(key_guid('#TestKey')
                                                      , N'KeyPhraseName')
      , @PublicKeyFileExt NVARCHAR(10)  = '.cer'
      , @PrivateKeyFileExt NVARCHAR(10) = '.prv'
      , @UseHash BIT                    = 1
      , @BackupNameBucket INT           
      , @BackupPath VARBINARY(8000)
      , @Backuptvp NAMEVALUETYPE
      , @DMKtvp NAMEVALUETYPE
      , @Keytvp NAMEVALUETYPE;
-- checksum truncation of the random lambda
SET @BackupNameBucket = ABS(CHECKSUM(HASHBYTES('SHA2_256'
    , RIGHT(CAST(DECRYPTBYKEY(@BackupName) AS NVARCHAR(448))
    , FLOOR(LEN(CAST(DECRYPTBYKEY(@BackupName) AS NVARCHAR(448)))/2)))));   
SET @BackupPath = ENCRYPTBYKEY( key_guid('#TestKey')
                              , N'Z:\BackupPath\', 1, @DbName); 
INSERT @Backuptvp (Name, Value) 
VALUES ( @BackupName    
       , ENCRYPTBYKEY( key_guid('#TestKey'), N'@Backuptvp.Value', 1
                     , CAST(DECRYPTBYKEY(@BackupName) AS NVARCHAR(448))));
IF @DMKPhraseName IS NOT NULL
  INSERT @DMKtvp (Name, Value) 
  VALUES ( @DMKPhraseName 
         , ENCRYPTBYKEY( key_guid('#TestKey'), N'@DMKtvp.Value', 1
                 , CAST(DECRYPTBYKEY(@DMKPhraseName) AS NVARCHAR(448))));
IF @KeyPhraseName IS NOT NULL AND @CipherType = 'PW'
  INSERT @Keytvp (Name, Value) 
  VALUES ( @KeyPhraseName 
         , ENCRYPTBYKEY( key_guid('#TestKey'), N'@Keytvp.Value', 1
                 , CAST(DECRYPTBYKEY(@KeyPhraseName) AS NVARCHAR(448))));
SELECT count(*) as [TVP] from @Keytvp
--------------------------------------------------------------------------
-- decryption with FORMATMESSAGE 
SELECT FORMATMESSAGE 
        ( 'USE %s;%sBACKUP CERTIFICATE TO FILE = ''%s%s%s'' %s;%s'
        , @DbName 
        , CASE WHEN @DMKPhraseName IS NOT NULL -- need to open master key
              THEN (SELECT FORMATMESSAGE 
                      ( 'OPEN MASTER KEY DECRYPTION BY PASSWORD = ''%s'';'
                      , CAST( DECRYPTBYKEY( Value
                          , 1
                          , CAST ( DECRYPTBYKEY( Name ) AS NVARCHAR(448) )
                          ) AS NVARCHAR(128) ) )
                    FROM @DMKtvp ) 
              ELSE '' END
        , CAST(DECRYPTBYKEY( @BackupPath, 1, @DbName ) AS NVARCHAR(1024) )  
        , CASE WHEN @UseHash = 1 
                THEN CAST( @BackupNameBucket AS NVARCHAR(448) )
                ELSE CAST( DecryptByKey( @BackupName ) AS NVARCHAR(448) ) 
                END 
      , @PublicKeyFileExt
      , CASE WHEN @CipherType <> 'NA'  
             THEN FORMATMESSAGE('WITH PRIVATE KEY ( FILE=''%s%s%s'', ENCRYPTION BY PASSWORD=''%s'' %s)'
                , CAST(DecryptByKey(@BackupPath, 1, @DbName ) AS NVARCHAR(1024)) 
                , CASE WHEN @UseHash = 1 
                        THEN CAST( @BackupNameBucket AS NVARCHAR(448) )
                        ELSE CAST( DecryptByKey( @BackupName ) AS NVARCHAR(448) ) 
                        END 
                , @PrivateKeyFileExt
                , ( SELECT CAST( DECRYPTBYKEY( Value
                                    , 1
                                    , CAST ( DECRYPTBYKEY( Name ) AS NVARCHAR(448) )
                                    ) AS NVARCHAR(128) )
                    FROM @BackupTvp )
                , CASE WHEN @CipherType = 'PW'    
                        THEN (SELECT FORMATMESSAGE 
                                        ( ', DECRYPTION BY PASSWORD = ''%s'''
                                        , CAST( DECRYPTBYKEY( Value
                                                , 1
                                                , CAST ( DECRYPTBYKEY( Name ) 
                                                            AS NVARCHAR(448) ) 
                                                ) AS NVARCHAR(128) ) )  
                                FROM @Keytvp )
                ELSE '' END )
        ELSE '' END

        , CASE WHEN @DMKPhraseName IS NOT NULL -- open master key
                THEN 'CLOSE MASTER KEY;'
                ELSE '' END );
GO
