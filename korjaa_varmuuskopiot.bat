@echo off
echo ==========================================
echo      SIIVOTAAN VARMUUSKOPIOT GITHUBISTA
echo ==========================================
echo.

echo 1. Lisataan _BACKUPS estolistalle (.gitignore)...
REM Lisataan rivi .gitignore-tiedostoon, jos se puuttuu
echo. >> .gitignore
echo _BACKUPS/ >> .gitignore
echo deploy_log.txt >> .gitignore

echo.
echo 2. Poistetaan varmuuskopiot pilvesta...
echo (Tamma EI poista tiedostoja sinun koneeltasi, vain GitHubista)
git rm -r --cached _BACKUPS
git rm --cached deploy_log.txt

echo.
echo 3. Tallennetaan siivous...
git add .gitignore
git commit -m "Siivous: Poistettu _BACKUPS ja loki versionhallinnasta"
git push

echo.
echo ==========================================
echo      VALMIS! NYT GITHUB ON PUHDAS.
echo ==========================================
echo Voit nyt poistaa taman tiedoston (korjaa_varmuuskopiot.bat).
pause