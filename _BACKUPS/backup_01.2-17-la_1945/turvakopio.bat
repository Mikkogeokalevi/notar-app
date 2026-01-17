@echo off
setlocal

REM Haetaan aikaleima muodossa VVVV-KK-PP_HHMM
set day=%date:~0,2%
set month=%date:~3,2%
set year=%date:~6,4%
set hour=%time:~0,2%
set min=%time:~3,2%
if "%hour:~0,1%" == " " set hour=0%hour:~1,1%

set foldername=_BACKUPS\backup_%year%-%month%-%day%_%hour%%min%

echo ==========================================
echo      LUODAAN PIKA-VARMUUSKOPIO
echo ==========================================
echo Kohde: %foldername%
echo.

REM Luodaan kansio
mkdir "%foldername%"

REM Kopioidaan vain TÄRKEÄT tiedostot (ei node_modules kansiota!)
xcopy "src" "%foldername%\src" /E /I /Y /Q
xcopy "public" "%foldername%\public" /E /I /Y /Q
copy "package.json" "%foldername%\" /Y
copy "vite.config.js" "%foldername%\" /Y
copy "index.html" "%foldername%\" /Y
copy "*.bat" "%foldername%\" /Y

echo.
echo ==========================================
echo      TURVAKOPIO OTETTU!
echo ==========================================
echo Loydat sen kansion "_BACKUPS" alta.
echo.
pause