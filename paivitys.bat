@echo off
echo ==========================================
echo      NOTAR APP - PAIVITYS & LOKI
echo ==========================================
echo.

echo 1. Tallennetaan muutokset Gitiin...
git add .
git commit -m "Paivitys %date% klo %time%"
git push

echo.
echo 2. Julkaistaan nettiin (npm run deploy)...
echo Tama vaihe voi kestaa hetken.
call npm run deploy

echo.
echo 3. Kirjataan lokitiedostoon (deploy_log.txt)...
echo PAIVITYS TEHTY: %date% klo %time% >> deploy_log.txt
echo ----------------------------------- >> deploy_log.txt

echo.
echo ==========================================
echo      VALMIS! LOKI PAIVITETTY.
echo ==========================================
pause