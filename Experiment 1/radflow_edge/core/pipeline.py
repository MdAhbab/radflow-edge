from .detector import XRayDetector
from .localizer import XRayLocalizer
from .analyzer import CheXagentAnalyzer
from .rag import RAGPipeline

class RadFlowPipeline:
    def __init__(self):
        print("Initializing Detector...")
        self.detector = XRayDetector()
        
        print("Initializing Localizer...")
        self.localizer = XRayLocalizer(self.detector.model)
        
        print("Initializing LLM Analyzer...")
        self.analyzer = CheXagentAnalyzer()
        
        print("Initializing RAG...")
        self.rag = RAGPipeline()

    def process_xray(self, image_path, patient_context=""):
        # 1. Detection
        findings, img_tensor = self.detector.detect(image_path, threshold=0.3)
        if not findings:
            return {"status": "normal", "message": "No significant findings."}

        results = []
        # Process the top 2 findings to save time
        top_findings = list(findings.items())[:2]
        
        for disease, confidence in top_findings:
            disease_idx = self.detector.diseases.index(disease)
            
            # 2. Localization
            heatmap = self.localizer.get_heatmap(img_tensor, disease_idx)
            bboxes = self.localizer.heatmap_to_bboxes(heatmap)
            crops = self.localizer.crop_regions(image_path, bboxes)
            
            # 3. RAG Retrieval
            rag_context = self.rag.retrieve(f"Guidelines for {disease}")
            
            # 4. LLM Analysis
            for crop in crops:
                report = self.analyzer.analyze(
                    crop_img=crop['image'],
                    disease_hint=disease,
                    patient_context=patient_context,
                    rag_context=rag_context
                )
                
                results.append({
                    "disease": disease,
                    "confidence": confidence,
                    "bbox": crop['bbox'],
                    "report": report
                })
                
        return {"status": "success", "results": results}
