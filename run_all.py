#!/usr/bin/env python3
"""
HSIL Hackathon 2026 - Unified Launcher
Runs Backend, Frontend, and AI Pipeline
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

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

def cleanup(signum=None, frame=None):
    """Cleanup function to terminate all processes on exit"""
    print_header("Shutting Down All Services")

    for name, proc in processes:
        if proc and proc.poll() is None:
            print_info(f"Stopping {name}...")
            try:
                if sys.platform == "win32":
                    # Windows: send CTRL_C_EVENT
                    proc.send_signal(signal.CTRL_C_EVENT)
                else:
                    # Unix: send SIGTERM
                    proc.terminate()
                proc.wait(timeout=5)
                print_success(f"{name} stopped")
            except subprocess.TimeoutExpired:
                print_warning(f"{name} didn't stop gracefully, forcing...")
                proc.kill()
            except Exception as e:
                print_error(f"Error stopping {name}: {e}")

    print_success("All services stopped")
    sys.exit(0)

def check_dependencies():
    """Check if required dependencies are installed"""
    print_header("Checking Dependencies")

    # Check Python
    python_version = sys.version_info
    print_info(f"Python: {python_version.major}.{python_version.minor}.{python_version.micro}")

    # Check pip packages
    required_packages = ['fastapi', 'uvicorn', 'sqlalchemy']
    try:
        import pkg_resources
        for package in required_packages:
            try:
                version = pkg_resources.get_distribution(package).version
                print_success(f"{package}: {version}")
            except pkg_resources.DistributionNotFound:
                print_error(f"{package} not found")
                print_warning(f"Install with: pip install {package}")
                return False
    except ImportError:
        print_warning("Unable to check packages, proceeding anyway...")

    # Check Node.js
    node_command = 'node.exe' if sys.platform == "win32" else 'node'
    try:
        result = subprocess.run([node_command, '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            print_success(f"Node.js: {result.stdout.strip()}")
        else:
            print_error("Node.js not found")
            return False
    except FileNotFoundError:
        print_error("Node.js not found. Please install Node.js")
        print_info("Download from: https://nodejs.org/")
        return False

    # Check npm (use npm.cmd on Windows)
    npm_command = 'npm.cmd' if sys.platform == "win32" else 'npm'
    try:
        result = subprocess.run([npm_command, '--version'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            print_success(f"npm: {result.stdout.strip()}")
        else:
            print_error("npm not found")
            print_warning("npm should be installed with Node.js. Try restarting your terminal.")
            return False
    except FileNotFoundError:
        print_error("npm not found")
        print_warning("npm should be installed with Node.js. Try restarting your terminal.")
        return False

    print_success("All dependencies OK")
    return True

def select_experiment():
    """Ask user which experiment to run"""
    print_header("Select AI Pipeline")

    print(f"{Colors.OKCYAN}Which AI pipeline would you like to run?{Colors.ENDC}\n")
    print(f"{Colors.BOLD}1.{Colors.ENDC} Experiment 1 - RadFlow-Edge Pipeline")
    print(f"   {Colors.OKBLUE}(CNN Detection + GradCAM + RAG + VLM){Colors.ENDC}")
    print(f"\n{Colors.BOLD}2.{Colors.ENDC} Experiment 2 - Foveal Engine")
    print(f"   {Colors.OKBLUE}(Attention-based Preprocessing){Colors.ENDC}")
    print(f"\n{Colors.BOLD}3.{Colors.ENDC} Both Experiments")
    print(f"\n{Colors.BOLD}4.{Colors.ENDC} Backend + Frontend Only (No AI)")

    while True:
        try:
            choice = input(f"\n{Colors.WARNING}Enter your choice (1-4): {Colors.ENDC}").strip()
            if choice in ['1', '2', '3', '4']:
                return int(choice)
            else:
                print_error("Invalid choice. Please enter 1, 2, 3, or 4")
        except KeyboardInterrupt:
            print("\n")
            cleanup()
        except Exception as e:
            print_error(f"Error: {e}")

def start_backend(pipeline_mode: str = "both"):
    """Start the FastAPI backend"""
    print_header("Starting Backend Server")

    backend_dir = Path(__file__).parent / "backend"

    if not backend_dir.exists():
        print_error(f"Backend directory not found: {backend_dir}")
        return None

    print_info(f"Backend directory: {backend_dir}")
    print_info("Starting FastAPI server on http://localhost:8000")
    print_info(f"Pipeline mode: {pipeline_mode}")

    try:
        backend_env = os.environ.copy()
        backend_env["HSIL_PIPELINE_MODE"] = pipeline_mode

        # Start backend using uvicorn command directly
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            cwd=backend_dir,
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )

        # Wait a bit and check if it started successfully
        time.sleep(3)
        if proc.poll() is not None:
            print_error("Backend failed to start")
            output, _ = proc.communicate()
            print(output)
            return None

        print_success("Backend server started")
        return proc
    except Exception as e:
        print_error(f"Failed to start backend: {e}")
        return None

def start_frontend():
    """Start the React frontend"""
    print_header("Starting Frontend Development Server")

    frontend_dir = Path(__file__).parent / "Frontend"

    if not frontend_dir.exists():
        print_error(f"Frontend directory not found: {frontend_dir}")
        return None

    # Check if node_modules exists
    node_modules = frontend_dir / "node_modules"
    npm_command = 'npm.cmd' if sys.platform == "win32" else 'npm'

    if not node_modules.exists():
        print_warning("node_modules not found. Installing dependencies...")
        print_info("This may take a few minutes...")

        try:
            install_proc = subprocess.run(
                [npm_command, 'install'],
                cwd=frontend_dir,
                check=True,
                shell=True
            )
            print_success("Dependencies installed")
        except subprocess.CalledProcessError as e:
            print_error(f"Failed to install dependencies: {e}")
            return None

    print_info(f"Frontend directory: {frontend_dir}")
    print_info("Starting Vite dev server (typically http://localhost:5173)")

    try:
        # Start frontend
        proc = subprocess.Popen(
            [npm_command, 'run', 'dev'],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=True,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )

        # Wait a bit and check if it started successfully
        time.sleep(2)
        if proc.poll() is not None:
            print_error("Frontend failed to start")
            return None

        print_success("Frontend server started")
        return proc
    except Exception as e:
        print_error(f"Failed to start frontend: {e}")
        return None

def monitor_processes():
    """Monitor all processes and display their output"""
    print_header("All Services Running")

    print(f"{Colors.OKGREEN}✓ Backend API: http://localhost:8000{Colors.ENDC}")
    print(f"{Colors.OKGREEN}✓ Frontend UI: http://localhost:5173{Colors.ENDC}")
    print(f"{Colors.OKGREEN}✓ API Docs: http://localhost:8000/docs{Colors.ENDC}")

    print(f"\n{Colors.WARNING}Press Ctrl+C to stop all services{Colors.ENDC}\n")
    print("="*60)

    try:
        while True:
            # Check if any process has died
            for name, proc in processes:
                if proc and proc.poll() is not None:
                    print_error(f"\n{name} has stopped unexpectedly!")

                    # Try to get output
                    try:
                        output, _ = proc.communicate(timeout=1)
                        if output:
                            print(f"\nLast output from {name}:")
                            print(output[-1000:])  # Last 1000 chars
                    except:
                        pass

                    cleanup()
                    return

            # Display output from processes (non-blocking)
            for name, proc in processes:
                if proc and proc.stdout:
                    try:
                        # Non-blocking read
                        import select
                        if sys.platform != "win32":
                            ready, _, _ = select.select([proc.stdout], [], [], 0)
                            if ready:
                                line = proc.stdout.readline()
                                if line:
                                    print(f"[{name}] {line.rstrip()}")
                    except:
                        pass

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n")
        cleanup()

def main():
    """Main entry point"""
    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    if sys.platform != "win32":
        signal.signal(signal.SIGTERM, cleanup)

    print_header("HSIL Hackathon 2026 - System Launcher")

    # Check dependencies
    if not check_dependencies():
        print_error("\nPlease install missing dependencies and try again")
        print_info("For Python packages: pip install -r requirements.txt")
        print_info("For Node.js: Download from https://nodejs.org/")
        sys.exit(1)

    # Select experiment
    experiment_choice = select_experiment()

    pipeline_mode = {
        1: "experiment1",
        2: "experiment2",
        3: "both",
        4: "none",
    }.get(experiment_choice, "both")

    # Start backend
    backend_proc = start_backend(pipeline_mode)
    if backend_proc:
        processes.append(("Backend", backend_proc))
    else:
        print_error("Failed to start backend. Exiting.")
        cleanup()
        return

    # Wait for backend to be fully ready
    print_info("Waiting for backend to initialize...")
    time.sleep(3)

    # Start frontend
    frontend_proc = start_frontend()
    if frontend_proc:
        processes.append(("Frontend", frontend_proc))
    else:
        print_error("Failed to start frontend. Stopping backend.")
        cleanup()
        return

    # Wait for frontend to be fully ready
    print_info("Waiting for frontend to build...")
    time.sleep(5)

    # Start selected experiment(s)
    if experiment_choice == 1:
        print_info("Experiment 1 mode active: /api/v1/analyze will use RadFlow pipeline")
    elif experiment_choice == 2:
        print_info("Experiment 2 mode active: /api/v1/analyze will use Foveal pipeline")
    elif experiment_choice == 3:
        print_info("Both experiment mode active: RadFlow + Foveal available")
    else:
        print_info("AI analysis disabled mode active (UI + backend only)")

    # Monitor all processes
    monitor_processes()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
