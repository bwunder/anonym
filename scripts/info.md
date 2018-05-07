The application considers ./scripts to include any file with a  '.sql' extension located
in folder. From the user's command prompt the file will always be copied to the
Batch buffer when invoked. The script may then be executed on the currently targeted
SQL Server using the user's desired termination command (go, run, sqlcmd or test).
The file may be modified using the user's preferred IDE, saved, and then loaded
as desired. No application restart is necessary. If the user has defined an editor
in config.json, any script can be opened in that editor by preceeding the file name
with the -e switch of the script command: 'script -e somefile.sql' (Note that the
path to the scripts folder is user configurable as the config.json element
vorpal.cli.scriptPath)
