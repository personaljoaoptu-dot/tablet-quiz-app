@echo off
title Servidor Quiz Tablet Pro
echo ========================================================
echo Iniciando Servidor Local para o Quiz no Tablet Android
echo ========================================================
echo.
echo Para acessar no seu Tablet (conectado na mesma rede Wi-Fi):
echo 1. Veja o seu Endereco IPv4 abaixo
echo 2. No tablet, abra o Chrome e digite: http://SEU-IP:8080
echo.
ipconfig | findstr /i "IPv4"
echo.
echo ========================================================
python -m http.server 8080
if %errorlevel% neq 0 (
    echo Python nao encontrado, tentando via npx serve...
    npx serve -l 8080
)
pause
