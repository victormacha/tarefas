# Team Task Manager — Batch Script

A command-line task management system built for a real company team of 4 people.
Developed in Batch Script due to environment limitations (Python unavailable on target machines).

## Features
- Add tasks with responsible person, date and description
- View tasks scheduled for today (automatic alert system)
- List all saved tasks
- Auto-initializer on system startup
- Flat-file database (no external dependencies)
- Full UTF-8 support for special characters

## How it works
Tasks are saved in a simple pipe-delimited `.txt` file.
The system filters tasks by today's date and alerts the team automatically.

## Files
- `tarefas.bat` — main system (menu, add, list, filter)
- `inicializador.bat` — auto-runs on startup

## Tech
- Windows Batch Script
- File-based persistence
- Built for a real production environment
