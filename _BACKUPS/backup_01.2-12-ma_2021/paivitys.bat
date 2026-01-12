@echo off
echo ==========================================
echo      NOTAR APP - PAIVITYS GITHUBIIN
echo ==========================================
echo.

echo 1. Rakennetaan sovellus (BUILD)...
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo VIRHE: Build epaonnistui! Keskeytetaan.
    pause
    exit /b
)

echo.
echo 2. Lahetetaan GitHubiin...
git add .
git commit -m "Paivitys %date% klo %time%"
git push origin main
git subtree push --prefix dist origin gh-pages

echo.
echo ==========================================
echo      PAIVITYS VALMIS!
echo ==========================================

REM --- TÄMÄ ON UUSI OSIO: LOKIKIRJAUS ---
echo PÄIVITYS TEHTY: %date% klo %time% >> deploy_log.txt
echo ----------------------------------- >> deploy_log.txt

pause