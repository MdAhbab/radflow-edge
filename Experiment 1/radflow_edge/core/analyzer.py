from transformers import AutoModelForCausalLM, AutoProcessor
import torch
from PIL import Image
import cv2
import os

try:
    from transformers import BitsAndBytesConfig
except Exception:
    BitsAndBytesConfig = None

class CheXagentAnalyzer:
    @staticmethod
    def _resolve_local_model_path(local_model_path: str) -> str:
        # Accept direct model folders and Hugging Face cache-style snapshots.
        if os.path.exists(os.path.join(local_model_path, "config.json")):
            return local_model_path

        snapshots_root = os.path.join(
            local_model_path,
            "models--StanfordAIMI--CheXagent-8b",
            "snapshots",
        )
        if os.path.isdir(snapshots_root):
            candidates = []
            for name in os.listdir(snapshots_root):
                candidate = os.path.join(snapshots_root, name)
                if os.path.isdir(candidate) and os.path.exists(os.path.join(candidate, "config.json")):
                    candidates.append(candidate)
            if candidates:
                candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
                return candidates[0]

        return local_model_path

    @staticmethod
    def _is_oom_error(error: Exception) -> bool:
        message = str(error).lower()
        return "out of memory" in message or "mps backend out of memory" in message

    def _build_model_kwargs(self, target_device: str) -> tuple[dict, bool]:
        use_4bit = (
            target_device == "cuda"
            and BitsAndBytesConfig is not None
            and os.getenv("HSIL_DISABLE_4BIT", "0") != "1"
        )

        model_kwargs = {
            "trust_remote_code": True,
            "low_cpu_mem_usage": True,
        }

        if use_4bit:
            model_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
            )
            model_kwargs["device_map"] = "auto"
        else:
            model_kwargs["torch_dtype"] = torch.float16 if target_device in {"cuda", "mps"} else torch.float32

        return model_kwargs, use_4bit

    def _load_model_for_device(self, resolved_model_path: str, target_device: str):
        model_kwargs, use_4bit = self._build_model_kwargs(target_device)
        model = AutoModelForCausalLM.from_pretrained(resolved_model_path, **model_kwargs)
        if not use_4bit:
            model.to(target_device)
        model.eval()
        return model, use_4bit

    def _move_model_to_cpu(self) -> None:
        self.model.to("cpu")
        self.device = "cpu"
        try:
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass

    def __init__(self, model_id="StanfordAIMI/CheXagent-8b", device=None):
        requested_device = os.getenv("HSIL_ANALYZER_DEVICE", "auto").lower()
        if device:
            self.device = device
        elif requested_device in {"cuda", "mps", "cpu"}:
            self.device = requested_device
        elif torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
        
        # Strictly use workspace-relative path for portability
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        local_model_path = os.path.join(base_dir, "models", "chexagent")
        
        if not os.path.exists(local_model_path):
             raise FileNotFoundError(
                f"Model not found in {local_model_path}. "
                "Please run `python Experiment 1/radflow_edge/download_models.py` first."
            )

        resolved_model_path = self._resolve_local_model_path(local_model_path)
        print(f"Loading CheXagent-8b from: {resolved_model_path}")
        self.processor = AutoProcessor.from_pretrained(resolved_model_path, trust_remote_code=True)

        self.model = None
        load_errors = []
        device_order = [self.device]
        if self.device == "mps":
            # If Apple GPU memory is insufficient, retry CPU so macOS VM/swap can still execute.
            device_order.append("cpu")

        for candidate_device in device_order:
            try:
                self.model, _ = self._load_model_for_device(resolved_model_path, candidate_device)
                self.device = candidate_device
                break
            except Exception as ex:
                load_errors.append(f"{candidate_device}: {ex}")
                if candidate_device == "mps" and self._is_oom_error(ex):
                    print("CheXagent MPS OOM during load. Retrying on CPU for stability.")
                    continue
                if candidate_device != device_order[-1]:
                    continue
                raise

        if self.model is None:
            raise RuntimeError("CheXagent failed to load. " + " | ".join(load_errors))

    def analyze(self, crop_img, disease_hint, patient_context='', rag_context=''):
        pil = Image.fromarray(cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB))
        prompt = f'''You are a radiology assistant.
Patient: {patient_context}
CNN finding: {disease_hint}
Guidelines: {rag_context}

Analyze this X-ray region. Provide:
FINDING: what you see
CONFIRM: yes/no for {disease_hint}
SEVERITY: mild/moderate/severe
LOCATION: anatomical description
ACTION: immediate recommendation'''

        inputs = self.processor(images=pil, text=prompt, return_tensors='pt')
        model_device = next(self.model.parameters()).device
        inputs = {k: v.to(model_device) for k, v in inputs.items()}

        try:
            with torch.no_grad():
                out = self.model.generate(**inputs, max_new_tokens=300)
        except RuntimeError as ex:
            if self.device == "mps" and self._is_oom_error(ex):
                print("CheXagent MPS OOM during generation. Falling back to CPU.")
                self._move_model_to_cpu()
                inputs = {k: v.to("cpu") for k, v in inputs.items()}
                with torch.no_grad():
                    out = self.model.generate(**inputs, max_new_tokens=300)
            else:
                raise
            
        return self.processor.decode(out[0], skip_special_tokens=True)
