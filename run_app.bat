@echo off
setlocal

rem Define the path to your Node.js script
set NODE_SCRIPT=index.js

rem Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js to run this script.
    exit /b 1
)

rem Check if the Node.js script file exists
if not exist %NODE_SCRIPT% (
    echo Error: '%NODE_SCRIPT%' does not exist.
    exit /b 1
)

rem Run the Node.js app
node %NODE_SCRIPT%

endlocal
