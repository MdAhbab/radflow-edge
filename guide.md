# HSIL Hackathon Setup Guide

This guide covers how to set up the project environment and run the services. Large files like Machine Learning models and datasets have been ignored from git to keep the repository size manageable.

## Folder Structure setup

Your workspace will need these large files which our team members have already downloaded:

1. **Models/**
   A copy of `Models/` folder needs to be downloaded from our shared drive and placed at the root of the project structure (`HSIL_Hackathon/Models`). It contains:
   - `chexagent/`
   - `chroma_db/`
   - `sentence_transformers/`
   - `xrv/`

2. **imagedata/** (Datasets / Images)
   Similarly, grab the `imagedata/` folder from the drive and place it at the root of the project structure.

## Environment Setup

### 1. Python Environment (Backend & AI)
We highly recommend setting up a python virtual environment first. 

```bash
# Create a virtual environment
python -m venv .venv

# Activate it
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# On macOS/Linux:
source .venv/bin/activate
```

Next, install all Python dependencies:
```bash
pip install -r requirements.txt
```

### 2. Node Setup (Frontend)
Ensure you have Node.js and npm installed. Check by running `npm -v` and `node -v` on your terminal.

```bash
cd Frontend
npm install
cd ..
```

## Running the Application

This repository comes with a unified launcher script to run the frontend, backend, and the AI Pipeline concurrently. 

From the root project directory with your virtual environment activated, run:

```bash
python run_all.py
```

It automatically starts the unified backend (`backend/main.py`) and frontend, and sets AI pipeline mode based on your choice.

### Important
- Use the unified backend entrypoint only (`backend/main.py`).
- If your frontend shows `Fallback API`, you are likely running a legacy API server that does not expose `/api/v1/cases` and `/api/v1/escalations`.
- With unified backend active, frontend data is dynamic from SQLite (`backend/radflow.db`) and backend routes.

Terminate with `Ctrl+C` when you are done. If you have issues on Windows, refer to `WINDOWS_TROUBLESHOOTING.md`.