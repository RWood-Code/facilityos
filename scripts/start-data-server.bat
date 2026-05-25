@echo off
title FacilityOS Data Server
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=1
set FACILITYOS_PORT=3847
set FACILITYOS_HOST=0.0.0.0
echo Starting FacilityOS data server on port %FACILITYOS_PORT%...
"%~dp0..\node_modules\electron\dist\electron.exe" server\index.js
pause
