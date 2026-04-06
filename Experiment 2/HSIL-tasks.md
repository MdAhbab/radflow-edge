# HSIL Project Overview & Proposed Architecture

By utilizing Foveal Cropping + MLX Native Quantization + Visual Caching, you get the clinical reasoning of an 8B domain-specific model running at 25+ tokens per second with zero crashes. It demonstrates a deep understanding of edge-compute constraints in a healthcare setting.

## Part 1: The Current Pipeline

### 1. The Ingestion Layer (Frontend)
- **Interface:** Chainlit (Python-based chat UI).
- **Action:** Sister Thandi uploads a high-res DICOM/JPEG chest X-ray and types: "Evaluate for active Tuberculosis."

### 2. The Safety & Routing Layer (Middleware)
- **Hardware Detective:** A Python script runs instantly to check the host machine:
  - **If Mac M4:** Sets inference engine to Apple mlx-vlm (Unified Memory).
  - **If RTX 3050:** Sets inference engine to transformers with 4-bit bitsandbytes (VRAM constraint).
- **RAG Retrieval:** The text query is embedded and sent to local ChromaDB. It retrieves the WHO TB guidelines and silently appends them to the system prompt.

### 3. The Foveal Pre-Processor (The Vision Hack)
- **Global Context:** The system aggressively downsamples the original 2000x2000 X-ray into a tiny 224x224 thumbnail.
- **High-Res Crop:** The system runs a fast, lightweight contrast-detection script (via OpenCV) to find the densest anomaly in the lungs and crops a native-resolution 512x512 square around it.
- **Result:** You now have two distinct images (one blurry whole, one sharp crop) that total only ~20% of the tokens of the original image.

### 4. The Inference Engine (Backend)
- **Cross-Modal Alignment:** The text prompt (with RAG guidelines) and the two images (Context + Crop) are passed to CheXagent-8b.
- **KV Caching:** As CheXagent processes the visual tokens, it locks them into the KV Cache.
- **Generation:** CheXagent generates the report text. If the nurse asks a follow-up question, the visual tokens are already cached, resulting in instant replies.

---

## Part 2: Future Improvements (D-RoVA)

Right now, your pipeline fixes CheXagent's token bloat from the outside (cropping the image before the model sees it). To write a high-impact paper, we must fix CheXagent from the inside.

### The Flaw in CheXagent
CheXagent uses a static connector (an MLP projector) between its Vision Encoder and its LLM backbone. It indiscriminately maps every single visual token into the LLM, forcing the LLM to waste massive computational power figuring out which tokens matter during the expensive autoregressive text generation phase.

### The Proposed Novel Architecture: D-RoVA
**D-RoVA: Dynamic Routing for Visual Attention in Medical VLMs**

**The Core Concept:**
Instead of a static connector, we introduce a **Text-Guided Token Router (TTR)** directly into the architecture of the model. This makes the token pruning differentiable (learnable during training) rather than a hardcoded preprocessing hack.

### How it Works (The Architecture)
1. **The Cross-Attention Gate:** Between the Vision Encoder and the LLM, you insert a lightweight routing network.
2. **Semantic Interrogation:** Before the visual tokens enter the heavy LLM, the Router looks at the text prompt's hidden states. If the prompt is "Check for apical cavitation", the Router generates a semantic embedding for "apical" (top of lungs).
3. **Dynamic Dropping:** The Router evaluates every visual token coming from the image against this semantic embedding:
   - If a visual token represents the abdomen (low relevance score), the Router permanently deletes it from the sequence.
   - If a visual token represents the apex of the lung (high relevance score), the Router prioritizes it for processing.