@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "release\LearningMentor-win32-x64\LearningMentor.exe" (
  start "" "release\LearningMentor-win32-x64\LearningMentor.exe"
) else (
  if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
  ) else (
    echo Please install dependencies and Electron first. See README.md.
    pause
  )
)
