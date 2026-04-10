import platform
import torch
import importlib.util

class MiddlewareRouter:
    """
    Safety & Routing Layer (Middleware)
    Checks hardware and dynamically routes the inference engine
    """
    
    @staticmethod
    def get_inference_backend():
        system = platform.system()
        machine = platform.machine()
        
        print(f"Detected System: {system} | Architecture: {machine}")
        
        if system == "Darwin" and machine == "arm64":
            mlx_available = importlib.util.find_spec("mlx_vlm") is not None
            if mlx_available:
                print("Apple Silicon detected. Routing to mlx-vlm (Unified Memory).")
                return "mlx"

            print("Apple Silicon detected but mlx-vlm is not installed. Falling back to CPU transformers.")
            return "cpu"
        
        elif torch.cuda.is_available():
            print("NVIDIA GPU detected. Routing to Hugging Face transformers (bitsandbytes 4-bit).")
            return "transformers_4bit"
            
        else:
            print("No dedicated VLM hardware detected. Defaulting to CPU transformers (Very Slow!).")
            return "cpu"

if __name__ == "__main__":
    MiddlewareRouter.get_inference_backend()
