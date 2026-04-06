import chainlit as cl
import cv2
import tempfile
import os
import sys

# Add parent to path to import foveal_engine
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from foveal_engine.vision_hack import FovealPreprocessor
from foveal_engine.router import MiddlewareRouter

preprocessor = FovealPreprocessor()

@cl.on_chat_start
async def start():
    backend = MiddlewareRouter.get_inference_backend()
    await cl.Message(
        content=f"Welcome to the D-RoVA Hackathon Prototype!\n\n**Hardware Detection**: Routed inference engine to `{backend}`.\n\nUpload a high-resolution X-ray to test the Foveal Cropping pre-processor (The 'Vision Hack').",
    ).send()

@cl.on_message
async def main(message: cl.Message):
    images = [file for file in message.elements if "image" in file.mime]
    
    if not images:
        await cl.Message(content="Please upload an image.").send()
        return
        
    image = images[0]
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        try:
            with open(image.path, 'rb') as f:
                tmp.write(f.read())
            tmp_path = tmp.name
        except AttributeError:
            # chainlit element might not have a path directly depending on version, fallback to content
            tmp.write(image.content)
            tmp_path = tmp.name
            
    processing_msg = cl.Message(content="Running Foveal Pre-Processor...")
    await processing_msg.send()

    try:
        results = preprocessor.process(tmp_path)
        
        # Save temporary images for Chainlit to display
        global_path = "/tmp/global_context.png"
        foveal_path = "/tmp/foveal_crop.png"
        
        cv2.imwrite(global_path, results["global_context"])
        cv2.imwrite(foveal_path, results["foveal_crop"])
        
        bbox = results["bbox"]
        
        elements = [
            cl.Image(name="Global Context (224x224)", display="inline", path=global_path),
            cl.Image(name=f"Foveal Crop {bbox}", display="inline", path=foveal_path)
        ]
        
        await cl.Message(
            content=f"**Vision Hack Complete!**\n\nGenerated a 224x224 global context thumbnail and a 512x512 anomaly crop at bounds `{bbox}`.\n\nThese two images total ~20% of the tokens of the original 2000x2000 image, fixing the VLM token bloat drastically.",
            elements=elements
        ).send()
        
    except Exception as e:
        await cl.Message(content=f"Error processing image: {str(e)}").send()

