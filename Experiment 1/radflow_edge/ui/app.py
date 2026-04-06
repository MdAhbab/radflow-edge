import chainlit as cl
import requests

API_URL = "http://localhost:8000/analyze"

@cl.on_chat_start
async def start():
    await cl.Message(
        content="Welcome to RadFlow-Edge! Upload an X-ray (PNG/JPG/DICOM) and provide patient context to begin triage.",
    ).send()

@cl.on_message
async def main(message: cl.Message):
    images = [file for file in message.elements if "image" in file.mime]
    
    if not images:
        await cl.Message(content="Please upload an image alongside your description.").send()
        return
        
    image = images[0]
    patient_context = message.content

    processing_msg = cl.Message(content="Analyzing the X-ray using Edge CNN models and CheXagent...")
    await processing_msg.send()
    
    # Send request to FastAPI backend
    try:
        with open(image.path, "rb") as f:
            files = {"file": (image.name, f, image.mime)}
            data = {"patient_context": patient_context}
            response = requests.post(API_URL, files=files, data=data)
            
        if response.status_code == 200:
            results = response.json()
            if results.get("status") == "normal":
                await cl.Message(content="No significant findings detected by the CNN.").send()
            else:
                findings_text = "### RadFlow-Edge Preliminary Triage \n\n"
                for i, r in enumerate(results.get("results", [])):
                    findings_text += f"**Finding {i+1}:** {r['disease']} (Confidence: {r['confidence']})\n"
                    findings_text += f"> {r['report']}\n\n"
                    
                await cl.Message(content=findings_text).send()
        else:
            await cl.Message(content=f"Error analyzing image: {response.text}").send()
    except Exception as e:
        await cl.Message(content=f"Backend unreachable. Ensure FastAPI is running. Error: {str(e)}").send()

