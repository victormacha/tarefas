@echo off
:: Garante que o Windows leia os acentos corretamente
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ANCORA: Garante que o arquivo de texto seja criado NA MESMA PASTA do aplicativo
set "arquivo=%~dp0tarefas_equipe.txt"

:: Pega APENAS os 10 ultimos caracteres da data
set data_hoje=%date:~-10%

:: Cria o arquivo de texto se ele ainda nao existir
if not exist "%arquivo%" type nul > "%arquivo%"

:menu
cls
echo ==========================================
echo      SISTEMA DE TAREFAS - DA EMPRESA
echo ==========================================
echo Hoje e: %data_hoje%
echo.
echo 1. Ver Avisos e Tarefas de Hoje
echo 2. Adicionar Nova Tarefa
echo 3. Ver Todas as Tarefas
echo 4. Sair
echo ==========================================
set /p opcao="Escolha uma opcao (1-4): "

if "%opcao%"=="1" goto avisos
if "%opcao%"=="2" goto adicionar
if "%opcao%"=="3" goto listar
if "%opcao%"=="4" goto fim
goto menu

:avisos
cls
echo ==========================================
echo          AVISOS PARA HOJE (%data_hoje%)
echo ==========================================
set encontrou=0
:: "usebackq" e necessario porque agora usamos o caminho completo do arquivo
for /f "usebackq tokens=1,2,* delims=|" %%a in ("%arquivo%") do (
    if "%%a"=="%data_hoje%" (
        echo [ALERTA] %%b precisa: %%c
        set encontrou=1
    )
)
if "!encontrou!"=="0" echo Nenhuma tarefa agendada para o dia de hoje.
echo ==========================================
pause
goto menu

:adicionar
cls
echo ==========================================
echo           ADICIONAR NOVA TAREFA
echo ==========================================
echo Equipe: Thaysa, Alira, Catherin e Raquel
echo.
set /p resp="Quem vai fazer? (Ex: Victor): "
set /p data="Qual a data? (Use o formato DD/MM/AAAA, Ex: 28/09/2026): "
set /p desc="O que precisa ser feito?: "

:: Salva a tarefa no caminho ancorado
echo %data%^|%resp%^|%desc%>>"%arquivo%"
echo.
echo Tarefa salva com sucesso! O sistema avisara no dia %data%.
pause
goto menu

:listar
cls
echo ==========================================
echo          TODAS AS TAREFAS SALVAS
echo ==========================================
for /f "usebackq tokens=1,2,* delims=|" %%a in ("%arquivo%") do (
    echo Data: %%a ^| Responsavel: %%b ^| Tarefa: %%c
)
echo ==========================================
pause
goto menu

:fim
exit
