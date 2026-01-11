@echo off
echo --- Tallennetaan muutokset... ---
git add .
git commit -m "Päivitys ja julkaisu"

echo.
echo --- Lähetetään koodit GitHubiin... ---
git push

echo.
echo --- Rakennetaan ja julkaistaan nettisivu... ---
call npm run deploy

echo.
echo --- VALMIS! Nyt voit sulkea ikkunan. ---
pause