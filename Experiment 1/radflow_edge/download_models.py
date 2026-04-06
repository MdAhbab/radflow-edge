# Download script for hackathon preparedness - run once
import os
import torch
from transformers import AutoProcessor, AutoModelForCausalLM
import torchxrayvision as xrv

def main():
    # Define local models directory strictly relative to workspace root
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    local_models_dir = os.path.join(base_dir, "models")
    os.makedirs(local_models_dir, exist_ok=True)
    
    print(f"Project models will be saved to: {local_models_dir}")

    # 1. Download/Verify TorchXRayVision DenseNet locally
    print("Downloading/Verifying TorchXRayVision DenseNet weights...")
    xrv_dir = os.path.join(local_models_dir, "xrv")
    os.makedirs(xrv_dir, exist_ok=True)
    
    # Overriding the library cache to local project folder
    os.environ["TORCH_XRAYVISION_CACHE"] = xrv_dir
    model = xrv.models.DenseNet(weights='densenet121-res224-all')
    print("TorchXRayVision DenseNet weights ready in ./models/xrv/.")

    # 2. Download/Verify CheXagent-8b locally
    print("\nDownloading/Verifying CheXagent-8b (approx ~16-31GB)...")
    chexagent_dir = os.path.join(local_models_dir, "chexagent")
    os.makedirs(chexagent_dir, exist_ok=True)
    
    # We use local_files_only=False first to download into cache_dir
    # pointing cache_dir to our project folder
    processor = AutoProcessor.from_pretrained(
        'StanfordAIMI/CheXagent-8b', 
        trust_remote_code=True,
        cache_dir=chexagent_dir
    )
    model = AutoModelForCausalLM.from_pretrained(
        'StanfordAIMI/CheXagent-8b', 
        trust_remote_code=True,
        cache_dir=chexagent_dir
    )
    print(f"CheXagent-8b model weights ready in ./models/chexagent/.")
    print(f"\nAll systems portable. ZIP the project and run on your high-config PC.")

if __name__ == '__main__':
    main()
