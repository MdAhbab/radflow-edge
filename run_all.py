#!/usr/bin/env python3
"""
HSIL Hackathon 2026 - Unified Launcher (Refactored)
Runs Backend, Frontend, and AI Pipeline with improved stability and multi-threaded logging.
"""

import os
import sys
import subprocess
import signal
import time
import threading
import queue
from pathlib import Path
from importlib import metadata

# Terminal colors for better visibility
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message:^60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(message):
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

# Global list to track all running processes
processes = []
log_queue = queue.Queue()


def get_venv_python() -> Path:
    project_root = Path(__file__).parent
    if sys.platform == "win32":
        return project_root / ".venv" / "Scripts" / "python.exe"
    return project_root / ".venv" / "bin" / "python"


def ensure_venv_python():
    """Relaunch with project venv interpreter when available."""
    venv_python = get_venv_python()
    if not venv_python.exists():
        return

    # Detect whether we're already running inside this project's virtualenv.
    venv_root = venv_python.parent.parent.resolve()
    current_prefix = Path(sys.prefix).resolve()
    if current_prefix == venv_root:
        return

    print_info(f"Switching to project virtualenv Python: {venv_python}")
    # Important: execute the venv path directly; resolving it can jump to the
    # base interpreter and lose virtualenv site-packages.
    os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve()), *sys.argv[1:]])

def kill_port(port):
    """Clear any process blocking a specific port on all supported platforms."""
    if sys.platform == "win32":
        try:
            cmd = f'netstat -ano | findstr LISTENING | findstr :{port}'
            output = subprocess.check_output(cmd, shell=True).decode()
            pids = set()
            for line in output.strip().split('\n'):
                parts = line.strip().split()
                if len(parts) > 4:
                    pid = parts[-1]
                    if pid.isdigit() and pid != '0':
                        pids.add(pid)

            for pid in pids:
                print_info(f"Purging existing process {pid} on port {port}...")
                subprocess.run(['taskkill', '/F', '/T', '/PID', pid], capture_output=True)
                time.sleep(0.5)
        except Exception:
            pass
        return

    try:
        result = subprocess.run(
            ["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return

        pids = [pid.strip() for pid in result.stdout.splitlines() if pid.strip().isdigit()]
        for pid in pids:
            print_info(f"Purging existing process {pid} on port {port}...")
            subprocess.run(["kill", "-TERM", pid], capture_output=True)

        time.sleep(0.5)

        result_after = subprocess.run(
            ["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
        )
        if result_after.returncode == 0:
            stale_pids = [pid.strip() for pid in result_after.stdout.splitlines() if pid.strip().isdigit()]
            for pid in stale_pids:
                subprocess.run(["kill", "-KILL", pid], capture_output=True)
    except Exception:
        pass

def reader_thread(name, stream, q):
    """Worker thread to read logs into the queue without blocking the launcher"""
    try:
        for line in iter(stream.readline, ''):
            if line:
                q.put((name, line.strip()))
    except Exception:
        pass
    finally:
        stream.close()

def cleanup(signum=None, frame=None):
    """Cleanup function to terminate all processes on exit"""
    print_header("Shutting Down All Services")

    for name, proc in processes:
        if proc and proc.poll() is None:
            print_info(f"Stopping {name}...")
            try:
                if sys.platform == "win32":
                    # Windows: use taskkill to kill the whole process tree (/T) and force (/F)
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
                else:
                    # Unix: send SIGTERM
                    proc.terminate()
                    proc.wait(timeout=5)
                print_success(f"{name} stopped")
            except Exception as e:
                print_error(f"Error stopping {name}: {e}")

    print_success("All services stopped")
    # Small delay for terminal to catch up
    time.sleep(1)
    # Use os._exit to force immediate exit if running in background
    os._exit(0)

def check_dependencies():
    """Check if required dependencies are installed"""
    print_header("Checking Dependencies")

    # Check Python
    python_version = sys.version_info
    print_info(f"Python: {python_version.major}.{python_version.minor}.{python_version.micro}")

    # Check pip packages
    required_packages = ['fastapi', 'uvicorn', 'sqlalchemy']
    for package in required_packages:
        try:
            version = metadata.version(package)
            print_success(f"{package}: {version}")
        except metadata.PackageNotFoundError:
            print_error(f"{package} not found")
            print_warning("Run with project venv: source .venv/bin/activate && python run_all.py")
            return False
        except Exception:
            print_warning("Unable to fully validate Python packages, proceeding anyway...")
            break

    # Check Node.js
    node_command = 'node.exe' if sys.platform == "win32" else 'node'
    try:
        result = subprocess.run([node_command, '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_success(f"Node.js: {result.stdout.strip()}")
        else:
            print_error("Node.js not found")
            return False
    except FileNotFoundError:
        print_error("Node.js not found. Please install Node.js")
        return False

    # Check npm (use npm.cmd on Windows)
    npm_command = 'npm.cmd' if sys.platform == "win32" else 'npm'
    try:
        result = subprocess.run([npm_command, '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_success(f"npm: {result.stdout.strip()}")
        else:
            print_error("npm not found")
            return False
    except FileNotFoundError:
        print_error("npm not found")
        return False

    print_success("All dependencies OK")
    return True

def start_backend(pipeline_mode: str = "experiment1"):
    """Start the FastAPI backend with multi-threaded log capture"""
    print_header("Starting Backend Server")

    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print_error(f"Backend directory not found: {backend_dir}")
        return None

    print_info(f"Starting FastAPI server on http://localhost:8000")
    
    try:
        backend_env = os.environ.copy()
        backend_env["HSIL_PIPELINE_MODE"] = pipeline_mode

        # Hot reload is opt-in: the watchfiles reloader keeps a second watcher
        # process alive and adds steady CPU/memory load on long-running devices.
        uvicorn_args = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
        if os.getenv("HSIL_DEV", "0") == "1":
            uvicorn_args.append("--reload")

        # Start backend
        proc = subprocess.Popen(
            uvicorn_args,
            cwd=backend_dir,
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )

        # Start log reader thread
        threading.Thread(target=reader_thread, args=("Backend", proc.stdout, log_queue), daemon=True).start()

        # Wait a bit and check if it started successfully
        time.sleep(2)
        if proc.poll() is not None:
            print_error("Backend failed to start immediately. Check port 8000 availability.")
            return None

        print_success("Backend server started")
        return proc
    except Exception as e:
        print_error(f"Failed to start backend: {e}")
        return None

def start_frontend():
    """Start the React frontend with multi-threaded log capture"""
    print_header("Starting Frontend Development Server")

    frontend_dir = Path(__file__).parent / "Frontend"
    if not frontend_dir.exists():
        print_error(f"Frontend directory not found: {frontend_dir}")
        return None

    npm_command = 'npm.cmd' if sys.platform == "win32" else 'npm'
    print_info(f"Starting Vite dev server on http://localhost:5173")

    try:
        # Start frontend
        proc = subprocess.Popen(
            [npm_command, 'run', 'dev'],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )

        # Start log reader thread
        threading.Thread(target=reader_thread, args=("Frontend", proc.stdout, log_queue), daemon=True).start()

        # Wait a bit and check if it started successfully
        time.sleep(2)
        if proc.poll() is not None:
            print_error("Frontend failed to start immediately. Check port 5173 availability.")
            return None

        print_success("Frontend server started")
        return proc
    except Exception as e:
        print_error(f"Failed to start frontend: {e}")
        return None

def monitor_processes():
    """Monitor all processes and display their output from the thread-safe queue"""
    print_header("All Services Running")
    print(f"{Colors.OKGREEN}✓ Backend API: http://localhost:8000{Colors.ENDC}")
    print(f"{Colors.OKGREEN}✓ Frontend UI: http://localhost:5173{Colors.ENDC}")
    print(f"\n{Colors.WARNING}Press Ctrl+C to stop all services{Colors.ENDC}\n")
    print("="*60)

    # Use a small buffer to store recent logs for crash diagnostics
    recent_logs = {name: [] for name, _ in processes}

    try:
        while True:
            # Check if any process has died
            for name, proc in processes:
                if proc and proc.poll() is not None:
                    print_error(f"\n{name} has CRASHED! (Exit code: {proc.returncode})")
                    
                    if recent_logs[name]:
                        print_warning(f"Last 5 lines of {name} output:")
                        for line in recent_logs[name][-5:]:
                            print(f"  [{name}] {line}")
                    
                    cleanup()
                    return

            # Process any logs in the queue (Non-blocking)
            try:
                while True:
                    name, line = log_queue.get_nowait()
                    if line:
                        print(f"[{name}] {line}")
                        recent_logs[name].append(line)
                        if len(recent_logs[name]) > 50:
                            recent_logs[name].pop(0)
                    log_queue.task_done()
            except queue.Empty:
                pass

            time.sleep(0.1) # Main loop is now very lightweight

    except KeyboardInterrupt:
        cleanup()

def main():
    """Main entry point"""
    ensure_venv_python()

    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    if sys.platform != "win32":
        signal.signal(signal.SIGTERM, cleanup)

    print_header("HSIL Hackathon 2026 - Stable System Launcher")

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Automatic pipeline mode
    pipeline_mode = os.getenv("HSIL_PIPELINE_MODE", "experiment1")

    # Aggressive port cleaning
    print_info("Performing pre-startup cleanup...")
    kill_port(8000)
    kill_port(5173)

    # Start services
    backend_proc = start_backend(pipeline_mode)
    if backend_proc:
        processes.append(("Backend", backend_proc))
    else:
        cleanup()
        return

    time.sleep(2)

    frontend_proc = start_frontend()
    if frontend_proc:
        processes.append(("Frontend", frontend_proc))
    else:
        cleanup()
        return

    monitor_processes()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"Unexpected launcher error: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
