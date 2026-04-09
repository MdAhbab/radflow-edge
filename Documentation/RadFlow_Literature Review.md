### **Title**

A data- and compute-efficient chest X-ray foundation model beyond aggressive scaling.

### **Literature Review**

Medical foundation models generally follow a "scale-at-all-costs" paradigm, training on increasingly massive datasets of image-text pairs to learn transferable representations. Models like RadFM and MedGemma utilize tens of millions of samples and thousands of compute hours. However, standard pretraining indiscriminately uses all available data, which is often redundant and severely imbalanced, biasing the model toward over-represented common patterns. Recent advances outside the medical domain suggest that carefully curated, compact subsets can match or exceed the performance of brute-force scaling.

### **Gap Analysis**

Existing medical foundation models suffer from extreme computational inefficiency and data redundancy. There is a lack of principled, active data curation strategies that account for the high heterogeneity in medical data quality and the long-tailed distribution of clinical conditions.

### **Contributions**

* **CheXficient**: Introduced a chest X-ray foundation model designed for both data and computational efficiency.  
* **Online Data Curator**: Implemented a prototype-driven mechanism that dynamically prioritizes informative training samples during pretraining.  
* **Efficiency**: Achieved state-of-the-art performance using only 22.7% of the data and under 27.3% of the compute budget compared to full-scale training.  
* **Improved Generalization**: Demonstrated enhanced performance on rare, long-tailed diseases by systematically up-weighting under-represented samples.

### **Methodologies**

CheXficient utilizes a contrastive language-image pretraining (CLIP) framework with an integrated online data curator.

* **Multimodal Embedding**: Concatenates image and text features into a unified representation.  
* **Prototype-Driven Selection**: Maintains evolving prototypical centroids to approximate the data manifold.  
* **Selective Sampling**: Prioritizes samples far from prototypes (rare/informative) while under-sampling redundant data near prototypes.  
* **Update Scheme**: Prototypes are updated via an optimal transport clustering algorithm and exponential moving averages (EMA).

### **Equations**

The model is optimized using the **InfoNCE** contrastive loss:

$$\\mathcal{L} \= \-\\log \\frac{\\exp(sim(z\_i^{img}, z\_i^{txt})/\\tau)}{\\sum\_{j} \\exp(sim(z\_i^{img}, z\_j^{txt})/\\tau)}$$

*(Note: While not explicitly printed in LaTeX in the text, the paper identifies the use of InfoNCE loss for alignment.)*

### **Results/Objective Reached**

* **Zero-Shot Performance**: CheXficient achieved comparable or superior AUROC across 20 benchmarks, including external datasets, despite using significantly less data.  
* **Label Efficiency**: Matched the performance of models trained on 100% random data while using only 10% of labeled samples for fine-tuning.  
* **Resource Savings**: Saved 72.7–81.8% of H100 GPU-hours compared to the full-data counterpart.

### **Future Works**

Future research will explore incorporating more advanced encoder architectures (e.g., ViT-Large) to enhance representational capacity. Additionally, the authors plan to expand evaluations to other radiological multimodal tasks like visual question answering and visual grounding, and increase coverage for a broader spectrum of rare thoracic conditions.

This summary outlines the key components of the paper titled **"A dataset of clinically generated visual questions and answers about radiology images."**

* **Literature Review**: Traditional Visual Question Answering (VQA) datasets primarily rely on crowdsourced general knowledge or synthetic generation from common objects (e.g., MSCOCO). Recent efforts in the medical domain, such as the ImageCLEF-Med challenge, used automatically generated questions from captions. While useful, these automated processes often produce artificial questions that lack clinical sense or include 3D reconstructions rarely used in direct patient care.  
* **Gap Analysis**: There is a significant lack of high-quality, manually constructed datasets where clinicians ask naturally occurring questions about radiology images. Existing datasets fail to assist in clinical decision support because they do not reflect the complex, nuanced reasoning required in a medical setting.  
* **Contributions**: The researchers introduce **VQA-RAD**, the first manually constructed dataset consisting of 315 radiology images and 3,515 question-answer (QA) pairs validated by clinicians. They also provide a taxonomy of medical VQA and demonstrate the dataset's value by benchmarking established algorithms.  
* **Methodologies**:  
  * **Image Selection**: 315 unique, clean radiology images were sampled from MedPix across three areas: head, chest, and abdomen.  
  * **QA Generation**: 15 clinical trainees generated "free-form" natural questions, rephrased versions, and template-based "framed" questions.  
  * **Validation**: Pairs were validated through clinician consensus and F1-score agreement (mean 0.85).  
* **Equations**: While the paper discusses benchmarking metrics such as **Simple Accuracy** (correct answers/total answers), **Mean Accuracy** (average across question types), and the **BLEU** score for linguistic similarity, it does not provide specific mathematical formulas.  
* **Results/Objective Reached**: The study found that baseline models (MCB and SAN) performed significantly better when trained on VQA-RAD, achieving up to 60.6% accuracy on closed-ended questions. However, performance on open-ended questions remained low (\~25.4%), highlighting the need for specialized medical vocabulary and image features.  
* **Future Works**: The authors anticipate extending VQA-RAD to produce more training data via automated bootstrapping, image synthesis, and data augmentation. They also emphasize the need for new evaluation metrics specifically aligned with clinical care.

This summary covers the paper titled **"A Dual-Attention Learning Network with Word and Sentence Embedding for Medical Visual Question Answering"**.

* **Literature Review**: Research in medical visual question answering (MVQA) is a hotspot for computer-aided diagnosis. Current models often use recurrent neural networks (RNN) or pre-trained BERT to extract word-level question features. However, these approaches often overlook the specialized medical semantics found in clinical texts.  
* **Gap Analysis**: Existing MVQA schemes primarily focus on word-level information, ignoring broader medical context. Furthermore, some feature-understanding schemes fail to effectively capture the fine-grained correlation between specific image regions and text keywords.  
* **Contributions**:  
  * Proposed **WSDAN**, a network that integrates word and sentence embeddings to better capture medical information.  
  * Designed the **Transformer with Sentence Embedding (TSE)** module for richer text representation.  
  * Developed the **Dual-Attention Learning (DAL)** module to model intensive intramodal and intermodal interactions.  
* **Methodologies**: The framework uses a pre-trained **ResNet-152** image encoder and the **TSE** question encoder. The **DAL** module employs an encoder-decoder structure utilizing both **self-attention** (intramodal) and **guided-attention** (intermodal).  
* **Equations**:  
  * **Attention mechanism**: $Attention(Q,K,V)=softmax(\\frac{QK^{T}}{\\sqrt{d\_{k}}})V$  
  * **TSE relational modeling**: $\\alpha\_{ij}=\\frac{1}{\\sqrt{2d}}(\\hat{q}*{i}W^{Q})(\\hat{q}*{j}W^{K})^{T}+\\frac{1}{\\sqrt{2d}}(SU^{Q})(SU^{K})^{T}$  
* **Results / Objective Reached**: WSDAN outperformed previous state-of-the-art methods on the **VQA-MED 2019** and **VQA-RAD** datasets. It achieved a 76.69% overall accuracy on VQA-RAD and 69.0% on VQA-MED 2019\.  
* **Future Works**: The authors plan to utilize an **image detection model** as the image encoder to better interact image objects with question keywords. They also suggest applying the TSE module to other biomedical text classification tasks.

This summary covers the paper titled **"A multimodal visual–language foundation model for computational ophthalmology"**.

* **Title**: A multimodal visual–language foundation model for computational ophthalmology.  
* **Literature Review**: Traditional ophthalmic AI models often focus on single modalities and lack consistency across different examinations or alignment between images and clinical language. Existing models like RETFound use self-supervised reconstruction on separate modalities, while others like VisionFM use modality-specific encoders, limiting their ability to capture shared representations across the full spectrum of clinical data.  
* **Gap Analysis**: Current foundation models in ophthalmology fail to achieve modality-modality consistency and image-language alignment. This prevents them from fully leveraging the multi-view, complementary information available in real-world clinical practice, where patients often undergo multiple types of imaging examinations alongside expert textual interpretations.  
* **Contributions**:  
  * Developed **EyeCLIP**, a foundation model trained on 2.77 million images across 11 modalities.  
  * Introduced a unified encoder framework that processes various modalities, reducing architectural complexity compared to modality-specific designs.  
  * Demonstrated state-of-the-art performance in zero-shot and few-shot scenarios for disease classification, VQA, and cross-modal retrieval.  
* **Methodologies**: EyeCLIP uses a CLIP-based framework extended with an image decoder for masked image reconstruction. The pretraining strategy combines three loss functions: image-text contrastive learning, image-image contrastive learning (for multi-examination alignment), and self-supervised masked image reconstruction.  
* **Equations**:  
  * **Total Loss**: $\\mathcal{L} \= \\lambda\_{img-text}\\mathcal{L}*{img-text} \+ \\lambda*{img-img}\\mathcal{L}*{img-img} \+ \\lambda*{recon}\\mathcal{L}\_{recon}$  
  * **Image-Text Contrastive Loss**: $\\mathcal{L}*{img-text}=-\\frac{1}{N}\\sum*{i=1}^{N}log\\frac{exp(sim(f(x\_{i}),g(t\_{i}))/\\tau)}{\\sum\_{j=1}^{N}exp(sim(f(x\_{i}),g(t\_{j}))/\\tau)}$  
* **Results/Objective Reached**: EyeCLIP significantly outperformed existing models like RETFound and BioMedCLIP across 14 benchmark datasets. It excelled in detecting rare diseases and predicting systemic conditions (e.g., stroke, dementia) from eye images, even with limited training data.  
* **Future Works**: Future research will focus on incorporating 3D information from modalities like OCT and FFA to capture volumetric data. Additionally, authors plan to integrate more ethnically diverse datasets to mitigate population-specific biases and explore model distillation for real-time clinical deployment on edge devices.

This summary provides an overview of the research paper **"A Question-Centric Model for Visual Question Answering in Medical Imaging."**

* **Title**: A Question-Centric Model for Visual Question Answering in Medical Imaging.  
* **Literature Review**: Most medical image analysis research has focused on indirect strategies like estimating prediction uncertainties or visualizing model support using saliency maps or Grad-CAM. Existing Visual Question Answering (VQA) techniques primarily use Bayesian models, modular sub-problem sequences, or neural network pooling schemes (e.g., MCB, MLB, MUTAN) to integrate image and question features.  
* **Gap Analysis**: Current multimodal fusion models often treat image and question features as equally important, which may lead the system to pay insufficient attention to critical question-related details.  
* **Contributions**: The authors introduce **Question-Centric Multimodal Low-rank Bilinear (QC-MLB)**, a novel fusion scheme that emphasizes question features. They also present a method for automated VQA ground truth pair generation for specific medical domains.  
* **Methodologies**: The model uses a **ResNet-152** image model and **Skip-thought vectors** for question encoding. It incorporates a multi-glimpse attention mechanism to select relevant image regions. To handle medical vocabulary not present in general datasets, they used transfer learning to map **Word2Vec** medical embeddings into the Skip-thought space.  
* **Equations**:  
  * **Question-centric fusion**: $f\_{qcmlb}=((\\mathcal{T}*{c} \\times*{1}(\\tilde{q}^{T}W\_{\\tilde{q}})^{2}) \\times\_{2}(\\tilde{v}^{T}W\_{\\tilde{v}})) \\times\_{3}W\_{o}$  
  * **Pre-tiled question emphasis**: $\\hat{q}\_{qcmlb}=RELU(W^{\\hat{q}}q+b^{\\hat{q}})^2$  
* **Results/Objective Reached**: QC-MLB with attention achieved equal or higher accuracy than state-of-the-art methods across four medical and two natural image datasets (e.g., 96.68% accuracy on "yes/no" questions for the Tools dataset). The model effectively highlighted relevant image regions used to generate answers.  
* **Future Works**: Future research includes learning the emphasizing function through automated processes rather than grid search, extending questions to arbitrary image sizes, and allowing user-defined queries through a GUI.

This summary covers the paper **"A Reasoning-Enabled Vision–Language Foundation Model for Chest X-ray Interpretation."**

* **Title**: A Reasoning-Enabled Vision–Language Foundation Model for Chest X-ray Interpretation.  
* **Literature Review**: Most existing AI systems for chest X-rays (CXRs) focus on final diagnostic predictions without explaining the underlying reasoning process. This answer-centric training can lead to "shortcut learning," where models exploit spurious correlations rather than clinically meaningful evidence. While some studies have explored reasoning, they typically cover a narrow range of tasks, and the clinical factuality of such reasoning remains unclear.  
* **Gap Analysis**: There is a lack of transparent justification for AI predictions in chest radiography, which limits clinician confidence and error detection in real-world workflows. Most current models lack the ability to provide explicit intermediate steps that link visual evidence to radiographic findings and final diagnoses.  
* **Contributions**:  
  * Developed **CheXOne**, a vision-language model (VLM) that jointly generates diagnostic predictions and explicit, clinically grounded reasoning traces.  
  * Curated **CheXReason**, a large-scale dataset of 4.5 million LLM-generated reasoning traces, and expanded **CheXinstruct-v2** to 14.7 million instruction samples covering 36 tasks.  
  * Proposed a two-stage training framework combining instruction tuning with reinforcement learning to improve reasoning factuality and causal support.  
* **Methodologies**:  
  * **Instruction Tuning (Stage 1\)**: Fine-tuning a pre-trained VLM (Qwen2.5-VL-3B) on combined datasets to establish foundational CXR knowledge and preliminary reasoning skills.  
  * **Reinforcement Learning (Stage 2\)**: Utilizing **Group Relative Policy Optimization (GRPO)** to refine reasoning logic based on task-specific rewards (accuracy for VQA, RadCliQ for report generation, and IoU for visual grounding).  
  * **Low-Variance Filtering**: Prioritizing the training of samples with the highest prediction variance to maximize learning efficiency.  
* **Equations**:  
  * **Instruction Tuning Loss**: $\\mathcal{L}*{IT}=-\\mathbb{E}*{(\\mathcal{X},\\mathcal{Q},\\mathcal{R},\\mathcal{A})\\sim\\mathcal{D}*i\\cup\\mathcal{D}r}\[\\sum{l=1}^{L}log f*{\\theta}(y\_l|\\mathcal{X},\\mathcal{Q},y\_{\<l})\]$.  
  * **Factuality Score ($S\_f$)**: $S\_f \= \\frac{|ent\_{model} \\cap ent\_{report}|}{|ent\_{model}|}$.  
  * **Self-consistency Score ($S\_{sc}$)**: $S\_{sc}=1-\\frac{Entropy}{log K}$.  
* **Results/Objective Reached**: CheXOne outperformed existing medical and general-domain foundation models across 17 evaluation settings, including VQA, report generation, and visual grounding. A clinical reader study showed that CheXOne-drafted reports were comparable to or better than resident-written reports in 55% of cases, significantly improving drafting efficiency for residents.  
* **Future Works**: Future directions include investigating larger model scales (e.g., mixture-of-experts architectures), incorporating expert-annotated reasoning chains rather than LLM-synthesized ones, and extending the model to support multimodal outputs like segmentation masks.

The following summary covers the survey paper **"A Survey of Medical Vision-and-Language Applications and Their Techniques."**

* **Title**: A Survey of Medical Vision-and-Language Applications and Their Techniques.  
* **Literature Review**: The paper notes exponential growth in medical multimodal data, creating a need for medical vision-language models (MVLMs). Unlike general models trained on non-specialized data, MVLMs are purpose-built for the medical domain. Previous surveys have been narrowly focused on specific tasks like medical report generation (MRG) or medical visual question answering (VQA).  
* **Gap Analysis**: While task-specific surveys exist, there is a lack of a holistic, longitudinal analysis that generalizes to the wider scope of vision-language models in medical AI. The field also faces challenges such as limited data accessibility due to privacy, high data heterogeneity, and the critical need for interpretability in clinical decision-making.  
* **Contributions**: The authors provide a comprehensive, up-to-date review of MVLMs over the last five years, covering tasks such as MRG, VQA, diagnosis/prognosis, medical image segmentation (MIS), and image-text retrieval (ITR). They identify overarching trends, examine datasets, and compare model performance using standardized metrics.  
* **Methodologies**: MVLMs typically integrate image encoders (e.g., ResNet, ViT) and text encoders (e.g., BERT, LSTMs) followed by specific generators or classifiers. Key techniques discussed include cross-modal alignment using shared feature spaces or attention mechanisms, and the recent use of Large Language Models (LLMs) for report generation.  
* **Equations**:  
  * **Visual Feature Extraction**: $V \= {v\_1, v\_2, ..., v\_N} \= f\_v(X)$.  
  * **Report Decoding**: $\\hat{Y} \= f\_d(V) \= f\_d(v\_1, v\_2, ..., v\_N)$.  
* **Results/Objective Reached**: The survey demonstrates consistent growth in MVLM literature. It provides detailed performance tables (e.g., BLEU, CIDEr for MRG and accuracy for VQA) for various state-of-the-art models across standard datasets like IU X-ray and VQA-RAD.  
* **Future Works**: Future research directions include overcoming data scarcity through generative methods (e.g., diffusion models), improving cross-modal fusion techniques, enhancing model generalization across different medical fields, and increasing clinical interpretability.

This summary outlines the survey paper **"A Survey on Efficient Vision-Language Models"**.

* **Title**: A Survey on Efficient Vision-Language Models.  
* **Literature Review**: Vision-language models (VLMs) integrate visual and textual information for applications like image captioning and visual question answering (VQA). Existing surveys often focus on general VLM architectures or specific pre-trained models. Advances in contrastive, masked, and generative modeling have fueled VLM development, using massive datasets and complex backbones.  
* **Gap Analysis**: As state-of-the-art VLMs grow in complexity, their high memory footprint and inference latency make them unsuitable for real-time deployment on resource-constrained edge devices (e.g., Jetson Nano). Previous surveys lack in-depth analysis of optimization techniques specifically tailored for these edge environments.  
* **Contributions**:  
  * Presents a taxonomy of techniques for optimizing VLMs, including pre-deployment, fine-tuning, and runtime optimizations.  
  * Lists state-of-the-art lightweight VLMs and optimization frameworks.  
  * Provides detailed insights into the performance-memory trade-offs for optimized VLMs.  
  * Establishes an actively maintained GitHub repository for surveyed papers.  
* **Methodologies**:  
  * **Pre-deployment**: Quantization (reducing bit precision), low-rank approximation (matrix decomposition), pruning (removing redundant weights), and knowledge distillation.  
  * **Fine-tuning**: Parameter-Efficient Fine-Tuning (PEFT) methods like LoRA, prompt tuning, and adapter-based methods.  
  * **Runtime**: Token reduction and Test-Time Adaptation (TTA).  
* **Equations**:  
  * **Boltzmann formula** for probability in contrastive learning: $P\_{\\phi}(x)=\\frac{e^{-E\_{\\phi}(x)}}{\\sum\_{x}e^{-E\_{\\phi}(x)}}$.  
  * **Symmetric quantization scale**: $\\eta=\\frac{2^{n-1}-1}{\\beta}$.  
  * **Low-rank update** in LoRA: $W^{\*}=W+\\Delta W=W+PQ^{T}$.  
* **Results/Objective Reached**: The paper establishes that efficiency techniques significantly reduce resource demands. For example, INT8 quantization reduced memory consumption by 53.8% for `blip-vqa-base`. Pruning and low-rank approximation resulted in faster inference per sample compared to standard models.  
* **Future Works**: Key directions include developing agentic AI and distributed VLMs at the edge, implementing on-the-fly fine-tuning, expanding to diverse sensor modalities (e.g., IMU, EEG), and improving model interpretability and security.

This summary covers the paper **"A Survey on Multimodal Large Language Models in Radiology for Report Generation and Visual Question Answering."**

* **Title**: A Survey on Multimodal Large Language Models in Radiology for Report Generation and Visual Question Answering.  
* **Literature Review**: The integration of Large Language Models (LLMs) and Large Vision Models (LVMs) has led to the rise of Multimodal Large Language Models (MLLMs). Prior reviews have separately examined medical Visual Question Answering (VQA), automated radiology report generation (RRG), and the general use of LLMs in clinical support.  
* **Gap Analysis**: Existing reviews often focus on LLMs without a thorough examination of MLLMs or emphasize general medical applications without providing detailed discussions specifically tailored to the unique requirements and datasets of radiology.  
* **Contributions**:  
  * Provides a detailed history of radiology's evolution and the development of MLLMs.  
  * Synthesizes key datasets, leading models, and evaluation metrics specifically for RRG and radiology VQA (RVQA).  
  * Identifies current challenges—such as data scarcity, hallucinations, and catastrophic forgetting—and proposes potential research directions.  
* **Methodologies**: The paper categorizes the current state of the field by examining RRG and RVQA frameworks. RRG typically uses encoder-decoder architectures to generate descriptive text from images, while RVQA employs image/question encoders and feature fusion to produce case-specific answers.  
* **Equations**:  
  * **BLEU score**: $BLEU\\text{-}n=BP\\cdot exp(\\sum\_{n=1}^{N}w\_{n}log p\_{n})$  
  * **ROUGE-L**: $ROUGE\\text{-}L \= \\frac{(1+ \\beta^2) \\cdot R \\cdot P}{R+ \\beta^2 \\cdot P}$  
  * **CIDEr n-gram score**: $CIDEr\_{n}(c\_{i},S\_{i})=\\frac{1}{m}\\sum\_{j}\\frac{g^{n}(c\_{i})\\cdot g^{n}(s\_{ij})}{||g^{n}(c\_{i})|||g^{n}(s\_{ij})||}$  
  * **RVQA Precision**: $Precision \= \\frac{TP}{TP \+ FP}$  
* **Results/Objective Reached**: The survey demonstrates that leading MLLMs (e.g., ClinicalBLIP, LLaVA-Med) achieve state-of-the-art performance on benchmarks like IU X-Ray and VQA-RAD. It establishes that MLLMs can significantly streamline clinical documentation and decision support.  
* **Future Works**: Future research should focus on utilizing Retrieval-Augmented Generation (RAG) to handle rare cases, implementing federated learning for privacy, and developing customized metrics that better capture clinical nuances.

This summary provides key details from the research paper **"A Vision-Language Foundation Model to Enhance Efficiency of Chest X-ray Interpretation."**

* **Title**: A Vision-Language Foundation Model to Enhance Efficiency of Chest X-ray Interpretation.  
* **Literature Review**: Chest X-rays (CXRs) are the most frequent imaging tests, but the high volume places a significant burden on radiologists, potentially leading to burnout and compromised accuracy. While machine learning models have been proposed to automate CXR interpretation, they are traditionally designed for narrow, task-specific applications like disease classification or report generation. Foundation models (FMs) offer a more versatile solution, but their development is hindered by a lack of curated, large-scale training datasets and holistic evaluation benchmarks.  
* **Gap Analysis**: There is a critical shortage of large-scale, multi-task datasets and comprehensive benchmarks for iteratively developing and evaluating FMs for CXR interpretation. Additionally, existing CXR FMs have primarily focused on report generation without robustly evaluating other critical capabilities.  
* **Contributions**:  
  * **CheXinstruct**: A large-scale dataset for CXR interpretation featuring 8.5 million samples across 35 tasks.  
  * **CheXagent**: A vision-language FM trained on CheXinstruct to perform diverse interpretation and reasoning tasks.  
  * **CheXbench**: A holistic evaluation benchmark covering eight clinically relevant task types across perception, reasoning, and text generation.  
  * **Clinical Utility**: A reader study demonstrating that CheXagent can save residents 36% of time when drafting reports.  
* **Methodologies**: CheXagent uses a 2.7-billion parameter **Phi-2** language decoder and a **SigLIP-Large** image encoder. Training involved a three-stage process: (1) training the language model on 2.7 billion clinical and general text tokens; (2) pre-training the image encoder on 1.05 million image-text pairs; and (3) joint instruction tuning of both components using the CheXinstruct dataset.  
* **Equations**:  
  * **Causal Language Modeling Loss**: Used to train the language decoder for next-word prediction.  
  * **SigLIP Loss**: Employed to train the image encoder to learn visual representations from paired text descriptions.  
* **Results/Objective Reached**: CheXagent consistently outperformed prior medical FMs (e.g., LLaVA-Med, RadFM), general-domain models (Qwen-VL), and proprietary models (GPT-4V) across perception and reasoning tasks. In clinical settings, using CheXagent-drafted reports improved writing efficiency for residents in 81% of cases without sacrificing report quality.  
* **Future Works**: Future research directions include investigating scaling laws for larger models, developing autonomous interpretation agents through self-improvement loops, and evaluating the impact of AI copilots on medical education.

Here is a summary of the review paper **"Advancements in Medical Radiology Through Multimodal Machine Learning: A Comprehensive Overview"**:

* **Title**: Advancements in Medical Radiology Through Multimodal Machine Learning: A Comprehensive Overview.  
* **Literature Review**: Traditional machine learning in healthcare has focused on single-modality data analysis, which lacks the reliability provided by a physician's multi-source diagnostic approach. Existing reviews have covered general deep learning in medicine, chest-specific analysis, and modality-agnostic methodologies. However, recent research (2019–2024) shows an exponential surge in multimodal AI interest, particularly pairings of radiography with text or omics.  
* **Gap Analysis**: Most current systems are insufficiently reliable because they do not process a variety of data simultaneously, unlike human doctors who examine multiple resources for diagnosis. There is a specific lack of research integrating temporal data (e.g., ECG/EEG time series) with imaging and a need for broader datasets beyond the current heavy focus on thoracic (chest) X-rays.  
* **Contributions**:  
  * Provides a comprehensive synthesis of 60 recent publications on multimodal machine learning (MMML) in radiology.  
  * Establishes a methodology-based taxonomy: modality fusion, representation learning, and cross-modality translation.  
  * Identifies key open-access datasets (e.g., MIMIC-CXR, ADNI, UK Biobank) to assist researchers.  
* **Methodologies**:  
  * **Modality Fusion**: Categorized into early (input stage), joint (intermediate), or late fusion (pooling predicted outcomes).  
  * **Representation Learning**: Focuses on acquiring enhanced features through self-supervised or contrastive learning (e.g., alignment using CLIP or BERT).  
  * **Cross-Modality Translation**: Includes automated radiology report generation (image-to-text) and conditioned image synthesis (text-to-image).  
* **Equations**:  
  * **Visual Feature Extraction**: $V \= {v\_1, v\_2, ..., v\_N} \= f\_v(X)$.  
  * **Report Decoding**: $\\hat{Y} \= f\_d(V) \= f\_d(v\_1, v\_2, ..., v\_N)$.  
* **Results/Objective Reached**: Multimodal models consistently outperform unimodal counterparts. For instance, late fusion for pulmonary embolism detection achieved an AUC of 0.947 compared to 0.791 for image-only models. Representation learning like ConVIRT demonstrated that multimodal pre-training is more label-efficient than supervised image training.  
* **Future Works**: Recommendations include expanding research to combinations of more than two modalities, integrating dynamic clinical time series data, and developing robust frameworks that can generate patient-level representations even when specific modalities are missing.

This summary covers the research paper **"AgenticLab: A Real-World Robot Agent Platform that Can See, Think, and Act."**

* **Title**: AgenticLab: A Real-World Robot Agent Platform that Can See, Think, and Act  
* **Literature Review**: Recent advances in large vision-language models (VLMs) have enabled strong open-vocabulary visual understanding. However, many existing VLM benchmarks rely on simulation or offline question-answering interfaces that do not execute actions. Real-robot VLM systems often use model-specific designs or one-shot planning that lacks feedback-driven correction and replanning.  
* **Gap Analysis**: There is a significant performance gap between static VLM benchmarks and real-world robot execution. Prior VLM-based manipulation pipelines are difficult to compare across different setups, and many evaluations miss failure modes that only emerge under closed-loop reasoning, such as object grounding under occlusion or insufficient spatial reasoning.  
* **Contributions**:  
  * Introduced **AgenticLab**, a model-agnostic robot agent platform for open-world manipulation.  
  * Presented a real-world benchmark that evaluates grounded perception and sequential decision-making under closed-loop execution.  
  * Released an open-source hardware and software stack to support reproducible evaluation.  
* **Methodologies**: AgenticLab utilizes a modular closed-loop framework categorized into "See," "Think," and "Act".  
  * **See**: Multi-view open-vocabulary perception using shoulder and wrist cameras.  
  * **Think**: A task parser converts instructions into PDDL (Planning Domain Definition Language), and an action checker verifies preconditions and effects.  
  * **Act**: High-level action primitives (e.g., pick, place) are executed via position-based control.  
* **Equations**: The paper evaluates performance using a **Task Progress Score**:

  $$Score \= \\frac{N\_{done} \- N\_{extra}}{N} \- 0.1p$$

  Where $N\_{done}$ is the number of correct actions, $N\_{extra}$ is redundant actions, $N$ is total actions, and $p$ is a binary penalty for goal-checker error.  
* **Results/Objective Reached**: The Gemini family was the most consistent, with **Gemini Flash** achieving a 75% success rate on the sorting task. The benchmark revealed that an agent's robustness is bounded by its weakest module, with verification quality (action checking) often dominating end-to-end performance.  
* **Future Works**: Future directions include exploring learning-based PDDL domain modeling to replace manually authored files, augmenting action primitives with learning-based skills, and distilling large VLMs into smaller models to reduce verification latency.

This summary covers the research paper **"AgentVLN: Towards Agentic Vision-and-Language Navigation"**.

* **Title**: AgentVLN: Towards Agentic Vision-and-Language Navigation.  
* **Literature Review**: Vision-and-Language Navigation (VLN) requires agents to follow natural-language instructions in complex 3D environments. Current systems are categorized into single-system architectures, which implicitly map features to actions, and dual-system architectures, which decouple high-level reasoning from low-level planning. Models often use Vision-Language Models (VLMs) like the LLaVA series or Qwen2.5-VL for semantic understanding.  
* **Gap Analysis**: Existing VLN systems struggle with limited spatial perception, representation mismatches between 2D images and 3D physical structures, and monocular scale ambiguity. Furthermore, high parameter counts (often ≥7B) and reliance on auxiliary depth modules make real-time deployment on edge devices challenging due to latency.  
* **Contributions**:  
  * **VLM-as-Brain Paradigm**: Decouples high-level semantic reasoning from low-level planning via a plug-and-play skill library.  
  * **Cross-Space Representation Mapping**: Projects 3D waypoints onto the 2D image plane to create pixel-aligned visual prompts for the VLM.  
  * **Query-Driven Perceptual Chain-of-Thought (QD-PCoT)**: Enables the agent to actively seek geometric depth information to resolve spatial ambiguity.  
  * **AgentVLN-Instruct Dataset**: A large-scale instruction-tuning dataset with dynamic stage routing.  
* **Methodologies**: The framework reformulates VLN as a Partially Observable Semi-Markov Decision Process (POSMDP). It utilizes a modular "See-Think-Act" loop where the VLM acts as a central controller, alternately invoking perception-level skills (e.g., SLAM for geometric mapping) and planning-level skills (e.g., closed-loop physical execution).  
* **Equations**:  
  * **Perspective Projection**: Projects a 3D path point ($P\_{path}^{w}$) to pixel coordinates ($p\_{path}^{img}$): $s \\cdot p\_{path}^{img} \= KR\_{t}^{-1}(P\_{path}^{w} \- t\_{t})$.  
  * **Skill Invocation Policy**: $c\_{k} \\sim \\pi\_{\\theta}(f|\\mathcal{H}*{t*{k}}, o\_{t\_{k}}, \\mathcal{I})$.  
  * **Target Point Transformation**: Back-projects 2D pixels to 3D local camera coordinates ($P\_{target}^{c}$): $P\_{target}^{c} \= d\_{target} \\cdot K^{-1}p\_{target}^{img}$.  
* **Results / Objective Reached**: AgentVLN-3B consistently outperformed larger state-of-the-art models on the R2R-CE and RxR-CE benchmarks, achieving 73.5% Success Rate (SR) on R2R-CE Val-Unseen while utilizing a substantially smaller parameter footprint. It successfully enabled real-time, on-device inference on Jetson embedded edge boards.  
* **Future Works**: The paper suggests that its modular methodology is generalizable to other sensor modalities like LiDAR by merely substituting relevant perception-layer skills in the library without retraining the multi-billion-parameter foundation model.

The following summary covers the research paper **"An Improved Medical Visual Question Answering Model Based on CLIP and BERT"**:

* **Title**: An Improved Medical Visual Question Answering Model Based on CLIP and BERT.  
* **Literature Review**: Most state-of-the-art VQA models utilize the Transformer architecture for human-level performance on standard benchmarks. In medical VQA (MedVQA), systems must reason about natural language queries alongside complex imagery like X-rays and MRIs. While general VQA has progressed, MedVQA is hindered by the complexity of medical data and a scarcity of large-scale datasets beyond small-scale options like VQA-RAD or SLAKE.  
* **Gap Analysis**: Standard VQA models often require more domain-specific knowledge to accurately interpret medical images. Retrieval-based techniques used to address this may recover irrelevant, conflicting, or unhelpful information from knowledge bases, which can harm model learning.  
* **Contributions**:  
  * Proposed an enhanced **MCAN model** specifically for medical contexts.  
  * Integrated **CLIP-based visual attributes** and **BERT** for improved multimodal feature extraction.  
  * Developed a framework utilizing **answer heuristics** (answer candidates and answer-aware examples) to facilitate more straightforward experimentation.  
* **Methodologies**:  
  * **Visual Encoding**: Replaced region-based features with grid-based features from a **CLIP graphical encoder** with an RN50×64 backbone.  
  * **Text Processing**: Utilized a pre-trained **BERT-large model** instead of the traditional basic LSTM network.  
  * **Architecture**: Built upon the **Modular Co-Attention Networks (MCAN)**, using self-attention and guided-attention for multimodal fusion.  
  * **Heuristics**: Employed **transfer learning** on the PMC-VQA dataset and selected "answer-aware" in-context examples based on nearest neighbors in a latent space.  
* **Equations**:  
  * **Multimodal fusion**: $f=W\_{b}(q,v)$.  
  * **Prediction vector**: $y=W\_{h}(f)$.  
  * **Answer candidate selection**: $Q\_{AC}=argTopK\_{j\\epsilon{1,2,...,S}}y\_{\[j\]}$.  
* **Results/Objective Reached**: The proposed model achieved an accuracy of **78.89%** on the PMC-VQA dataset, representing an **11.09% improvement** over previous state-of-the-art models like MEVF-BAN and CPRD-BAN.  
* **Future Works**: The paper identifies weaknesses in keyword identification—such as incorrectly focusing on certain medical terms—suggesting that future improvements will focus on refining the attention mechanism for better keyword relevance.

This summary is based on the paper **"Barriers in Integrating Medical Visual Question Answering into Radiology Workflows: A Scoping Review and Clinicians’ Insights"**.

* **Title**: Barriers in Integrating Medical Visual Question Answering into Radiology Workflows: A Scoping Review and Clinicians’ Insights.  
* **Literature Review**: Medical Visual Question Answering (MedVQA) has emerged to assist radiologists by automating medical image interpretation through AI-driven question answering. While technical advancements in datasets and models exist, their real-world clinical utility remains underexplored. Current research often prioritizes technical performance over clinical relevance and integration into practice.  
* **Gap Analysis**: There is a significant disconnect between MedVQA research and clinical reality. Existing models often lack support for multi-view imaging, EHR integration, and domain-specific reasoning, while evaluation metrics typically fail to reflect clinical utility. Furthermore, nearly 60% of current QA pairs are non-diagnostic, offering minimal assistance to practicing radiologists.  
* **Contributions**:  
  * Conducted a scoping review of 68 radiology-specific MedVQA studies.  
  * Integrated feedback from 50 experienced healthcare professionals from India and Thailand.  
  * Proposed a question taxonomy categorized by clinical utility (non-diagnostic vs. diagnostic).  
  * Identified eight core challenges hindering MedVQA adoption in radiology workflows.  
* **Methodologies**:  
  * **Scoping Review**: Followed the Arksey and O'Malley framework to map concepts, gaps, and advancements in studies published between 2018 and 2024\.  
  * **Clinician Survey**: Collected quantitative and qualitative insights from surgeons, radiologists, and physicians via a targeted online survey.  
* **Equations**: The paper identifies standard evaluation metrics but does not provide specific mathematical formulas. It notes the use of:  
  * **Classification metrics**: Accuracy, recall, precision, and F1-score.  
  * **Generation metrics**: BLEU, METEOR, WBSS, and CBSS.  
* **Results/Objective Reached**: The study confirmed significant barriers to integration. Only 29.8% of surveyed clinicians found current MedVQA systems highly useful. Key requirements for clinical impact include domain-specific knowledge integration (87.2%), multi-view diagnostics (78.7%), and dialogue-based interactive systems (89.4%).  
* **Future Works**: Recommendations include developing clinically grounded, dialogue-based datasets curated by radiologists. Future models should prioritize multi-resolution support, interpretability (e.g., attention maps, reasoning rationales), and seamless interoperability with clinical systems like PACS and EHRs.

This summary provides an overview of the research paper **"Caption-Aware Medical VQA via Semantic Focusing and Progressive Cross-Modality Comprehension"**.

* **Title**: Caption-Aware Medical VQA via Semantic Focusing and Progressive Cross-Modality Comprehension.  
* **Literature Review**: Medical Visual Question Answering (VQA) has recently gained success but remains limited by the scarcity of large-scale annotated medical datasets. Existing models often rely on convolutional neural networks (CNNs) for visual features, often pre-trained on natural scene datasets like ImageNet, which creates a domain gap. To extract text features, models commonly use word embedding algorithms like Global vectors followed by LSTM or GRU, though recent state-of-the-art methods utilize pre-trained models like BioBERT.  
* **Gap Analysis**: Current medical VQA models often summarize visual features of different local regions equally through averaging, failing to focus on specific semantic regions critical to answering clinical questions. Furthermore, typical joint comprehension models are designed for bilinear interactions between only two sources (image and question), making it difficult to integrate a third source like image captions.  
* **Contributions**:  
  * Proposed utilizing an attention-based image captioning model to provide medical prior knowledge for VQA.  
  * Designed a **similarity analysis** mechanism to locate semantic-rich regions and extract focused visual features.  
  * Developed the **Progressive Compact Bilinear Interactions (PCBI)** model to achieve cross-modality comprehension over three sources: images, questions, and captions.  
  * Achieved new state-of-the-art results on public medical VQA datasets including VQA-RAD and SLAKE.  
* **Methodologies**:  
  * **Semantic-Oriented Image Captioning**: Utilizes a "Show Attend and Tell" structure trained on the ROCO dataset to generate captions and attention weight maps.  
  * **Semantic Focusing**: Groups attention maps via similarity analysis; weighted summation is then applied to visual features based on these obtained mean attention maps.  
  * **Textual Encoding**: Uses BioBERT for both question and caption feature extraction, with **stride pooling** applied to compress caption features.  
  * **PCBI**: A two-stage pipeline that first combines question and caption features, then fuses the resulting representation with visual features using Bilinear Attention Networks (BAN).  
* **Equations**:  
  * **Similarity Analysis (Best Cluster Results)**: $\\hat{S} \= arg \\min \\sum\_{i=1}^{N} \\frac{1}{|S\_i|} \\sum\_{\\alpha\_j, \\alpha\_k \\in S\_i} ||\\alpha\_j \- \\alpha\_k||^2$.

    |---|---|---|---|---|  
  * **Bilinear Attention Map (Stage 1\)**: $A^{(1)} \= g(((\\mathbb{I} \\cdot (p^{(1)})^T) \\circ QW\_q^{(1)\\prime})YW\_y^{\\prime})$.  
* **Results/Objective Reached**: The proposed model achieved the highest overall accuracy on the VQA-RAD (75.8%) and SLAKE-EN (82.5%) datasets compared to existing methods. Qualitative analysis confirmed the model correctly focuses on relevant anatomical regions (e.g., kidneys) to answer specific clinical questions.  
* **Future Works**: The paper does not explicitly detail a "Future Works" section, but notes that the current multi-task learning scheme brings performance improvements mainly to open-ended answers rather than closed-ended ones, suggesting a potential area for further refinement.

Based on the provided research paper, here is the requested summary of **CheXagent**:

* **Title**: CheXagent: Towards a Foundation Model for Chest X-Ray Interpretation.  
* **Literature Review**: Recent advances in vision-language foundation models (FMs) have enabled automated chest X-ray (CXR) interpretation. While FMs are capable of diverse reasoning and comprehension tasks, their application in radiology has been limited by a lack of large-scale, curated medical datasets and comprehensive benchmarks.  
* **Gap Analysis**: There is a need for robust FMs specifically designed for CXR interpretation that can handle both coarse- and fine-grained image understanding alongside complex text generation. Furthermore, a lack of rigorous benchmarks makes it difficult to systematically evaluate these models against existing general and medical-domain models.  
* **Contributions**:  
  * **CheXinstruct**: A large-scale instruction-tuning dataset with 6 million instruction-image-answer triplets derived from 28 publicly available datasets.  
  * **CheXagent**: An 8-billion parameter instruction-tuned FM designed to analyze CXR images and generate summarized clinical responses.  
  * **CheXbench**: A novel benchmark for systematically evaluating FMs across eight clinically relevant CXR interpretation tasks.  
* **Methodologies**:  
  * **Clinical LLM Training**: Infusing medical knowledge into a Mistral-7B-v0.1 base model using sources like PMC articles and MIMIC-IV.  
  * **Vision Encoder**: Training a vision encoder on image-text pairs from datasets like MIMIC-CXR and PadChest to read CXRs.  
  * **Vision-Language Bridger**: Developing a network to map visual data into the language semantic space.  
  * **Instruction Tuning**: Final training on the CheXinstruct dataset with optimal dataset ratios to ensure balanced capabilities.  
* **Equations**: The provided text does not explicitly list mathematical equations, but it defines the model's aim as generating responses ($y$) based on seen images ($x\_{I}$) and read text ($x\_{T}$).  
* **Results/Objective Reached**: CheXagent outperformed previous general-domain and medical-domain FMs on CheXbench tasks by up to 97.5%. For instance, it achieved 97.5% accuracy in View Classification on MIMIC-CXR and demonstrated superior performance in disease classification and findings generation.  
* **Future Works**: The paper concludes that the introduced scheme effectively trains CXR FMs. While specific "Future Works" are not explicitly bulleted, the authors performed bias evaluations across demographic factors like race, sex, and age to improve future model transparency.

Based on the provided research paper, here is the summary for **CheXalign**:

* **Title**: CheXalign: Preference fine-tuning in chest X-ray interpretation models without human feedback.  
* **Literature Review**: Vision-language models (VLMs) show promise for chest X-ray (CXR) interpretation and radiology report generation (RRG). Standard post-training for these models typically relies on supervised fine-tuning (SFT). However, SFT can be insufficient as it may inadvertently increase the probability of "bad" completions alongside "good" ones. In general domains, preference fine-tuning like RLHF or Direct Preference Optimization (DPO) is used to align models with human values, but this remains largely unexplored for medical VLMs.  
* **Gap Analysis**: The primary obstacle to preference fine-tuning in radiology is the prohibitive cost and difficulty of obtaining expert radiologist feedback at scale. There is also a lack of investigation into "alignment tax"—potential performance degradation in other tasks after preference tuning—within the medical vision-language domain.  
* **Contributions**:  
  * Introduced **CheXalign**, a fully automated and scalable pipeline for generating preference data for RRG using existing image-report datasets.  
  * Introduced **LC-GREEN**, a length-controlled version of the GREEN score to mitigate reward overoptimization.  
  * Achieved new **state-of-the-art CheXbert scores** on the MIMIC-CXR dataset for RRG.  
  * Demonstrated that alignment can be achieved using inexpensive, general-domain metrics without an alignment tax on other visual tasks.  
* **Methodologies**: The pipeline samples candidate reports from an SFT baseline and uses automated **reference-based metrics** (like GREEN or BERTScore) as "Judges" to compare them against radiologist-written reference reports. These preference pairs are then used to optimize the model policy using direct alignment algorithms (DAAs) such as **DPO, LC-DPO, IPO, KTO, or ORPO**.  
* **Equations**:  
  * **DPO Loss**: $\\mathcal{L}*{DPO}(\\theta) \= \-\\log \\sigma\\left(\\beta \\log \\frac{\\pi*{\\theta}(y\_c|x)}{\\pi\_{ref}(y\_c|x)} \- \\beta \\log \\frac{\\pi\_{\\theta}(y\_r|x)}{\\pi\_{ref}(y\_r|x)}\\right)$.  
  * **LC-GREEN**: $LC\\text{-}GREEN := GREEN / \\max(rel\_verbosity, 1)$.  
* **Results/Objective Reached**: The best configurations boosted average CheXbert scores by up to **14%**. The method achieved state-of-the-art performance while maintaining robust capabilities across six additional image perception and reasoning tasks, proving no significant alignment tax.  
* **Future Works**: Future research includes conducting larger-scale **reader studies with clinical experts**, investigating **societal biases** in the data or Judges, and exploring **online or on-policy RL alignment algorithms** using verifiable rewards.

Based on the provided research paper, here is the summary for **ChexFract**:

* **Title**: ChexFract: From General to Specialized \- Enhancing Fracture Description Generation.  
* **Literature Review**: Recent vision-language models (VLMs) like MAIRA-2 and CheXagent have made strides in general radiology report generation. Historically, convolutional networks such as CheXNet achieved high accuracy in thoracic disease classification, but lacked the ability to generate descriptive reports. Standard datasets like MIMIC-CXR and PadChest facilitate this research but suffer from significant class imbalance.  
* **Gap Analysis**: General-purpose VLMs often fail to adequately describe rare but clinically significant pathologies like fractures. This is due to the inherent scarcity of fractures in available datasets and the suboptimal nature of existing rule-based labelers like CheXpert, which often miss fractures described with nuanced language.  
* **Contributions**:  
  * Development of **ChexFract**, a specialized, large-scale fracture-focused dataset comprising 18,710 image-description pairs.  
  * Creation of a refined "gold standard" test set by relabeling MIMIC-CXR using GPT-4o, increasing fracture detection sensitivity from 77 to 154 cases.  
  * Public release of optimized, specialized fracture-reporting models.  
* **Methodologies**: The researchers utilized the **Phi-3.5 Vision Instruct** model as a backbone, testing it with specialized visual encoders from MAIRA-2 (Rad-DINO) and CheXagent. They employed a two-step dataset construction process: extracting fracture sentences using GPT-4o and then standardizing them into canonical descriptions via **location-specific templates**. Models were trained using both frozen and unfrozen encoder configurations.  
* **Equations**: The model training utilized **Cross Entropy Loss**. To evaluate the clinical utility of the ensemble approach, a **Task Progress Score** was mentioned for robotic contexts in related papers, but this specific paper focuses on standard classification metrics like ROC-AUC, F1-score, and Balanced Accuracy derived from textual outputs.  
* **Results/Objective Reached**: Specialized fine-tuning significantly outperformed general-purpose models. The best fine-tuned model achieved an **F1-score of 0.629**, a 7.4x improvement over the MAIRA-2 baseline (0.085). Text standardization through templating and unfreezing encoders consistently enhanced performance, reaching a peak **ROC-AUC of 0.715**.  
* **Future Works**: Future directions include extending this specialized approach to other rare pathologies, conducting prospective clinical validation to assess real-world utility, and incorporating multi-modal data sources to further improve diagnostic accuracy.

This summary outlines the research project **"CXR-Agent: Vision-language models for chest X-ray interpretation with uncertainty aware radiology reporting."**

* **Title**: CXR-Agent: Vision-language models for chest X-ray interpretation with uncertainty aware radiology reporting.  
* **Literature Review**: Large vision-language models (VLMs) have shown potential for complex image interpretation and natural language generation. Current state-of-the-art (SOTA) foundational models for chest X-ray (CXR) interpretation include **CheXagent**, an instruction-tuned model, and **BioViL-T**, which explicitly accounts for temporal information in radiology reports.  
* **Gap Analysis**: Publicly available VLMs like CheXagent often produce confident hallucinations, which can slow clinical interpretation and reduce trust. Furthermore, these models frequently overfit to specific medical settings (e.g., intensive care units) and lack the ability to express clinical uncertainty in their reports.  
* **Contributions**:  
  * Development of an **agent-based vision-language approach** for report generation.  
  * Introduction of **uncertainty-aware radiology reporting** to improve clinical interpretability.  
  * Implementation of **linear probes** to analyze and utilize foundational vision encoders as tools in agent workflows.  
  * A custom **evaluation platform** for user studies with respiratory specialists.  
* **Methodologies**: The project uses **linear probing** on CheXagent’s vision transformer (ViT) and Q-former to extract robust visual features. These features are passed to a standalone **Large Language Model (LLM)**, such as Gemini 1.5-Flash or Llama 3\. **BioViL-T** is integrated as a phrase-grounding tool for pathology localization.  
* **Equations**:  
  * **2D Convolutional Kernel**: $(Image\*Kernel)\[i,j\]=\\sum\_{m=0}^{M-1}\\sum\_{n=0}^{N-1}Image\[i-m,j-n\]\\cdot Kernel\[m,n\]+b$.  
  * **Attention Score**: $Attention Score \= \\frac{Q\\cdot K^{T}}{\\sqrt{d\_{k}}}$.  
  * **Attention Block Output**: $Attention Block Output \= softmax(attention score). V$.  
* **Results/Objective Reached**: The agent-based approach showed considerable improvements in **accuracy, interpretability, and safety** over end-to-end models. Gemini and Llama 3 agents outperformed CheXagent in report generation, producing fewer dangerous reports and fewer temporal hallucinations.  
* **Future Works**: Proposed extensions include developing **localization probes**, implementing **function calling** for more versatile user Q\&A, and fine-tuning models on larger, more **diverse datasets** to further reduce hallucinations and overfitting.

This summary details the research paper **"Development of a large-scale medical visual question-answering dataset."**

* **Title**: Development of a large-scale medical visual question-answering dataset.  
* **Literature Review**: While Large Language Models (LLMs) like GPT-4 have achieved success in medical natural language processing, they are essentially blind to visual modalities like medical images. Existing Medical Visual Question Answering (MedVQA) methods typically treat the problem as a retrieval task with a limited answer base. Models such as Flamingo and BLIP have primarily been trained on natural language and images, with very limited application in the complex and nuanced medical domain.  
* **Gap Analysis**: Current MedVQA models are often constrained to limited use cases because they rely on predefined outcomes rather than free-form interaction. Furthermore, existing medical VQA datasets are limited in size and diversity, which is insufficient for training high-performing generative models.  
* **Contributions**:  
  * Constructed **PMC-VQA**, the first large-scale medical VQA dataset containing 227,000 VQA pairs across 149,000 images covering diverse modalities and diseases.  
  * Developed **MedVInT**, an open-ended generative MedVQA model capable of handling diverse questions and generating free-form answers.  
  * Established a challenging, manually verified test set (PMC-VQA-test) and a leaderboard to facilitate benchmarking for generative MedVQA methods.  
* **Methodologies**:  
  * **Data Collection**: Generated 1.5 million QA pairs by prompting ChatGPT with image captions from the PMC-OA dataset.  
  * **Filtering**: Applied an automatic filtering pipeline using a text-only LLaMA-7B model to remove questions answerable by text alone, and a question classifier to remove unanswerable questions.  
  * **Architecture**: Proposed two MedVInT variants: MedVInT-TE (tailored to encoder-based language models) and MedVInT-TD (tailored to decoder-based language models).  
* **Equations**:  
  * **MedVQA Formulation**: $\\hat{a}*{i} \= MedVQA(I*{i}, q\_{i}; \\Theta) \= dec(vis(I\_{i}; \\theta\_{vis}), text(q\_{i}; \\theta\_{text}); \\theta\_{dec})$.  
  * **Training Loss (Negative Log-Likelihood)**: $\\mathcal{L}(\\Theta) \= \-\\sum\_{t=1}^{T} \\log p(a^{t} | I, q^{1:T}, a^{1:t-1}; \\Theta)$.  
* **Results/Objective Reached**: MedVInT significantly outperformed existing models, achieving over 80% accuracy on multi-choice selections in public benchmarks such as VQA-RAD and SLAKE. Pre-training on PMC-VQA led to a \~16% accuracy increase for open-ended questions on VQA-RAD.  
* **Future Works**: The authors plan to explore more accurate evaluation metrics beyond BLEU and ACC scores to better capture the fluency of generated sentences. They also aim to address issues like model hallucinations to move toward real clinical applications.

This summary outlines the Ph.D. synopsis titled **"Enhancing Visual Question Answering for Medical Images using Transformers"**.

* **Title**: Enhancing Visual Question Answering for Medical Images using Transformers.  
* **Literature Review**:  
  * Traditional Medical Visual Question Answering (MedVQA) systems utilize Convolutional Neural Networks (CNNs) like ResNet or VGG for image feature extraction and Recurrent Neural Networks (RNNs) or LSTMs for processing textual queries.  
  * Attention mechanisms are commonly employed to find relationships between important image regions and the conceptual context of questions.  
  * Recent advancements include the use of Transformer architectures, such as Vision Transformers (ViT) and BERT, which have significantly improved performance over traditional methods by capturing complex relationships and global features.  
* **Gap Analysis**:  
  * Traditional CNN and RNN-based methods struggle to fetch intrinsic relationships between images and text in specialized medical datasets.  
  * Medical images often contain significant noise (e.g., salt and pepper, Gaussian) added during acquisition or transmission, which degrades quality and hampers accurate feature extraction.  
  * Deep learning models typically require large amounts of labeled training data, but medical datasets are often small, mislabeled, or unlabeled.  
  * Existing systems often lag behind human doctors in accuracy and struggle with various answer expressions or difficult diagnostic questions.  
* **Contributions**:  
  * Proposed a novel framework integrating Vision Transformer (ViT), Language Transformer (BERT), and a Convolutional Autoencoder (CAE).  
  * Implemented a CAE in the preprocessing stage to effectively denoise medical images, leading to improved feature extraction and VQA performance.  
  * Achieved state-of-the-art results on the VQA-Med 2019 dataset, outperforming traditional CNN-based models.  
* **Methodologies**:  
  * **Pre-Processing**: Raw medical images are denoised using a Convolutional Autoencoder (CAE) to produce cleaner inputs.  
  * **Feature Extraction**: Denoised images are processed by a Vision Transformer (ViT-B) to extract visual features, while textual questions are encoded using a pre-trained BERT model for semantic context.  
  * **Fusion**: Visual and textual features are combined in a fusion module using concatenation followed by a fully connected layer.  
  * **Answer Prediction**: A Multi-Layer Perceptron (MLP) with a multiclass classifier generates the final answer.  
* **Equations**:  
  * **Denoising (CAE)**: $I' \= CAE(I)$.  
  * **Image Feature Extraction**: $F\_{Image} \= ViT(I')$.  
  * **Question Feature Extraction**: $F\_{Question} \= BERT(Q)$.  
  * **Multimodal Fusion**: $F\_{fusion} \= \\sigma(W\_{fusion}\[F\_{Image}; F\_{Question}\] \+ b\_{fusion})$.  
  * **Answer Prediction**: $Y' \= softmax(W\_{out}F\_{fusion} \+ b\_{out})$.  
  * **Loss Function (Cross-Entropy)**: $L \= \- \\sum\_{i=1}^{C} y\_i \\log(y'\_i)$.  
* **Results/Objective Reached**:  
  * The integrated CAE+ViT+BERT model achieved **88.46% accuracy**, **87.90% precision**, and **87.34% F1-score** on the VQA-Med 2019 test set.  
  * Applying the CAE improved accuracy by approximately 6% compared to the ViT+BERT model alone.  
  * In a separate inference test on unseen VQA-RAD data, the model achieved **86.66% accuracy**.  
* **Future Works**:  
  * Explore additional training strategies like semi-supervised learning to address data scarcity in medical imaging.  
  * Apply transfer learning from general-purpose medical imaging models to improve system robustness.  
  * Further address domain-specific challenges, including model interpretability and the incorporation of clinical knowledge for better practical utility.

Based on the provided research paper, here is the summary for **Evaluating General Vision-Language Models for Clinical Medicine**:

* **Title**: Evaluating General Vision-Language Models for Clinical Medicine.  
* **Literature Review**: Advances in Large Language Models (LLMs) have led to clinical applications like guideline recommendations and patient encounter summarization. Because medicine is multimodal, Large Multimodal Models (LMMs) like GPT-4V, LLaVA-Med, and Med-Flamingo have been introduced to include visual understanding for medical decision-making.  
* **Gap Analysis**: Integrating LMMs into image-heavy clinical specialties like radiology and dermatology presents challenges regarding accuracy, reliability, and clinical relevance. There is also a need for reasoning that aligns with clinical expectations to gain practitioner trust.  
* **Contributions**: The study provides a comprehensive evaluation of GPT-4V across gastroenterology, radiology, dermatology, and USMLE questions. It benchmarks GPT-4V against robust datasets, evaluates its diagnostic abilities compared to medical experts, and assesses potential biases related to skin tone.  
* **Methodologies**: Researchers used a Python script via the ChatGPT web interface with predefined, specific zero-shot prompts including multiple-choice options to reduce hallucinations. Evaluation metrics included macro/micro averages for precision, recall, and F1-score, as well as the Matthews Correlation Coefficient (MCC).  
* **Equations**: While specific mathematical formulas are not explicitly written out, the paper utilizes standard statistical metrics including **MCC**, **Macro/Micro averages of precision, recall, and F1-score**, **sensitivity**, and **specificity**.  
* **Results/Objective Reached**: GPT-4V generally underperformed compared to established baseline models and experts. For example, in gastroenterology, it achieved a macro F1-score of only 6.81% compared to a baseline of 65.04%. In dermatology, diagnostic accuracy was significantly lower for darker skin tones (FST V-VI), highlighting potential biases.  
* **Future Works**: Future research should investigate LMM sensitivity to various prompting techniques and explore hybrid models that combine LMM capabilities with other robust, specialized models. Challenges regarding accuracy and healthcare bias must be resolved before deployment.

Here is a summary of the survey paper **"Exploring the Frontier of Vision-Language Models: A Survey of Current Methodologies and Future Directions"**:

* **Title**: Exploring the Frontier of Vision-Language Models: A Survey of Current Methodologies and Future Directions.  
* **Literature Review**: Traditional Large Language Models (LLMs) are primarily restricted to processing textual information. Recent efforts have integrated visual capabilities with LLMs to create Vision-Language Models (VLMs). Previous surveys in this domain have explored pre-trained techniques, datasets, practical applications, or a limited number of specific models.  
* **Gap Analysis**: Prior surveys have not systematically classified VLMs based on their specific input-processing and output-generation capabilities. This paper addresses that gap by providing a thorough categorization of approximately 70 models.  
* **Contributions**:  
  * Proposed a new taxonomy classifying VLMs into three categories: Vision-Language Understanding (VLU), Multimodal Input with Textual Output, and Multimodal Input with Multimodal Output.  
  * Analyzed foundational architectures, training data sources, strengths, and limitations for each model.  
  * Provided a comprehensive comparative analysis of VLM performance across various benchmark datasets, including VQA, image captioning, and the latest MME benchmark.  
* **Methodologies**:  
  * The general architecture of a VLM typically consists of an image encoder and a text encoder to generate embeddings.  
  * These embeddings are then fused in an image-text fusion layer (e.g., Q-former, Perceiver Resampler, or MLP).  
  * The fused vector is passed through an LLM decoder to generate visually aware text or multimodal outputs.  
* **Equations**: The paper discusses various loss functions and architectural components, such as contrastive loss used in CLIP for zero-shot performance and masked "language" modeling in BEiT-3, though it does not explicitly list standalone mathematical formulas in the main text.  
* **Results/Objective Reached**:  
  * The survey successfully categorizes approximately 70 models, offering a nuanced understanding of the VLM landscape.  
  * Benchmark comparisons show that models like **GPT-4V** and **Gemini** exhibit high performance on perception and cognition tasks (MME benchmark).  
  * Specialized models like **InstructBLIP** and **LLaVA 1.5** achieve state-of-the-art results on datasets like Science-QA and VQAv2.  
* **Future Works**:  
  * Exploring the tradeoff between pre-training and modular structures to increase faithfulness.  
  * Incorporating finer modalities such as gaze or gestures.  
  * Investigating causality, counterfactual capabilities, and continual learning/unlearning in VLMs.  
  * Developing more domain-specific VLMs for sectors like education, agriculture, and healthcare.  
  * Improving VLM safety against adversarial images and prompt-injection attacks.

The following summary is for the paper **"GEMeX: A Large-Scale, Groundable, and Explainable Medical VQA Benchmark for Chest X-ray Diagnosis."**

* **Title**: GEMeX: A Large-Scale, Groundable, and Explainable Medical VQA Benchmark for Chest X-ray Diagnosis.  
* **Literature Review**: Large vision-language models (LVLMs) have shown remarkable capabilities in understanding visual content and generating natural language. Within healthcare, Medical Visual Question Answering (Med-VQA) has emerged as a crucial task to assist professionals in diagnosis and clinical decision-making. Existing Med-VQA datasets like VQA-RAD, SLAKE, and PMC-VQA have advanced the field but often focus on simple image-text alignment.  
* **Gap Analysis**: Current Med-VQA benchmarks suffer from two primary limitations: (1) a lack of visual and textual explanations for answers, which hinders comprehension for patients and junior doctors; and (2) a narrow range of question formats that do not reflect the diverse inquiries encountered in practical clinical scenarios.  
* **Contributions**:  
  * Introduced **GEMeX**, the largest chest X-ray VQA dataset to date, containing 151,025 images and 1,605,575 questions.  
  * Developed the first Med-VQA dataset to provide **multimodal explainability**, offering both detailed textual reasoning and visual grounding (bounding boxes) for each answer.  
  * Expanded question diversity by including **four types**: open-ended, closed-ended, single-choice, and multiple-choice.  
  * Established a comprehensive benchmark by evaluating 12 representative LVLMs and proposing a strong baseline model.  
* **Methodologies**:  
  * **Data Construction**: Utilized a two-stage pipeline.  
  * **Stage I (Re-grounding)**: Refined the Chest ImaGenome dataset by collaborating with radiologists to redefine 30 precise anatomical regions. A medical LLM (OpenBioLLM-70B) was used to ensure accurate one-to-one correspondence between report sentences and visual regions.  
  * **Stage II (VQA Generation)**: Employed GPT-4o to generate 1.6 million VQA pairs based on re-grounded reports, covering seven clinical categories such as abnormality, location, and severity.  
  * **Fine-tuning**: Proposed **LLaVA-Med-GEMeX**, a baseline model created by fine-tuning LLaVA-Med-v1-7B on the GEMeX training set using a question-type-aware instruction tuning strategy.  
* **Equations**: While specific mathematical formulas for the models are not explicitly listed in the main text, the paper identifies the use of several evaluation metrics:  
  * **AR-score**: A combination of answer and reasoning correctness, quantified semantically using GPTScore.  
  * **A-score**: Accuracy for specific answer formats (e.g., yes/no or choice options).  
  * **V-score**: Mean intersection over union (**mIoU**) to measure the accuracy of visual grounding.  
  * **Natural Language Generation (NLG) metrics**: BLEU, ROUGE, and BERTScore were used to evaluate textual reasoning.  
* **Results/Objective Reached**:  
  * Most existing LVLMs performed poorly on the benchmark; GPT-4o-mini was the only model to achieve an average AR-score above 80\.  
  * The proposed fine-tuned baseline, **LLaVA-Med-GEMeX**, achieved an average AR-score of **86.04%**, significantly outperforming the original LLaVA-Med-v1 (72.53%).  
  * Fine-tuning on GEMeX also demonstrated strong **transferability**, significantly improving performance on the SLAKE-CXR test set compared to zero-shot models.  
* **Future Works**: The paper highlights room for exploration in fully accurate medical reasoning and suggests that the true potential of GEMeX lies in its integration into broader **multi-task training frameworks** to enhance general clinical conversational agents.

This summary details the review paper titled **"Generative Models in Medical Visual Question Answering: A Survey."**

* **Title**: Generative Models in Medical Visual Question Answering: A Survey.  
* **Literature Review**: Early Medical Visual Question Answering (MedVQA) systems primarily utilized discriminative models, which select answers from predefined candidates using frameworks like CNNs for image encoding and RNNs for question processing. To address data limitations, researchers introduced techniques such as meta-learning, conditional reasoning, and contrastive learning (e.g., PubMedCLIP). Recent advancements have shifted toward generative models that leverage transformer decoders, Large Language Models (LLMs), and Multimodal Large Language Models (MLLMs) to produce free-form, context-sensitive responses.  
* **Gap Analysis**: While substantial research has focused on MedVQA, the predominant focus has been on discriminative approaches that struggle with open-ended or out-of-domain questions. Existing surveys have primarily covered these discriminative methods or broader MedVQA aspects, leaving a gap for a comprehensive review focused specifically on the paradigm shift toward generative models.  
* **Contributions**: This survey examines the evolution from discriminative to generative systems, analyzing diverse model architectures and training processes. It summarizes evaluation benchmarks and metrics while highlighting key techniques such as instruction tuning, domain adaptation, and parameter-efficient fine-tuning (PEFT). Additionally, it proposes future directions for enhancing clinical reasoning and building robust evaluation benchmarks.  
* **Methodologies**: Generative MedVQA systems typically consist of four components: an image feature extractor (e.g., ResNet, ViT), a question feature extractor (e.g., BERT), a cross-modal fusion module (e.g., co-attention, MLP projection), and an answer generator (e.g., LLaMA, GPT). Training often involves vision-language pretraining (VLP) followed by task-specific fine-tuning or instruction tuning to align models with clinical needs.  
* **Equations**: While the survey describes various technical frameworks, specific mathematical formulas are not detailed in the provided text.  
* **Results/Objective Reached**: Generative models, especially those based on LLMs/MLLMs like Uni-Med and LLaVA-Med, generally outperform discriminative models on open-ended questions in benchmarks like Slake and VQA-RAD. For example, Uni-Med achieved 85.3% accuracy on Slake.  
* **Future Works**: The survey identifies several future directions, including addressing dataset limitations such as data bias and hallucination in LLMs. Other goals include developing more robust, clinically-aligned evaluation metrics, improving model efficiency and scalability through techniques like quantization and pruning, and navigating regulatory and ethical considerations for real-world clinical deployment.

This summary covers the research paper **"Interpretable Medical Image Visual Question Answering via Multi-Modal Relationship Graph Learning."**

* **Title**: Interpretable Medical Image Visual Question Answering via Multi-Modal Relationship Graph Learning.  
* **Literature Review**: Most current medical VQA methods utilize a joint embedding framework with black-box convolutional neural networks (CNNs) as backbones. These models often exploit dataset biases and capture superficial correlations between images and questions rather than deeply understanding spatial or semantic knowledge. Existing medical datasets, such as VQA-RAD and ImageCLEF VQA-Med, are limited by small sizes and relatively simple questions.  
* **Gap Analysis**: There is a significant lack of large-scale, specialized datasets that reflect the complex "coarse-to-fine" diagnostic reasoning used by clinicians. Current systems lack interpretability and do not adequately incorporate spatial, semantic, or professional medical knowledge into their reasoning processes.  
* **Contributions**:  
  * Constructed **Medical-CXR-VQA**, a large-scale dataset of 780,014 QA pairs focused on chest X-rays, covering abnormalities, locations, levels, types, presence, and views.  
  * Proposed a novel VQA framework using **multi-modal relationship graph learning**.  
  * Demonstrated that the learned model provides visual interpretability through medical reasoning paths, enhancing clinician confidence.  
* **Methodologies**:  
  * **Data Collection**: Leveraged GPT-4 to generate training data for fine-tuning Llama 2, which then extracted key information from 215,547 studies in the MIMIC-CXR database.  
  * **Graph Construction**: Constructed three relationship graphs: **Spatial** (based on ROI coordinates), **Semantic** (using anatomical and disease co-occurrence knowledge), and **Implicit** (to discover latent relationships).  
  * **Reasoning**: Used a Relation-Aware Graph Attention Network (ReGAT) to update nodes and fused the graph features with a multilayer perceptron (MLP) for final answer prediction.  
* **Equations**:  
  * **Final Prediction**: $a\_{final} \= (1 \- \\alpha \- \\beta) \\times a\_{imp} \+ \\alpha \\times a\_{spa} \+ \\beta \\times a\_{sem}$.  
  * **Implicit Attention Weights**: $\\alpha\_{ij} \= \\frac{\\alpha\_{ij}^{b} \\cdot exp(\\alpha\_{ij}^{v})}{\\sum\_{j=1}^{K} \\alpha\_{ij}^{b} \\cdot exp(\\alpha\_{ij}^{v})}$.  
  * **Loss Function**: $L\_{final} \= L\_{imp} \+ L\_{spa} \+ L\_{sem}$.  
* **Results/Objective Reached**: The model outperformed state-of-the-art baselines (MMQ and VQAMix), achieving a **Top-1 accuracy of 0.5802** and a **Macro-AUC of 0.9846**. Visualizations confirmed that the model focuses on clinically relevant ROIs, such as the heart area for cardiomegaly questions.  
* **Future Works**: The authors provided uncertainty and opacity information within the KeyInfo dataset for future use by the research community. The paper also notes that future work could focus on refining these models to further reduce hallucinations and improve performance on challenging "type" questions.

This summary covers the research paper **"Lingshu: A Generalist Foundation Model for Unified Multimodal Medical Understanding and Reasoning."**

* **Title**: Lingshu: A Generalist Foundation Model for Unified Multimodal Medical Understanding and Reasoning.  
* **Literature Review**: Recent advancements in Multimodal Large Language Models (MLLMs) have propelled progress in common visual tasks, but their medical performance remains constrained. Existing specialized models often suffer from limited domain coverage, high hallucination rates due to noisy PubMed-derived datasets, and a lack of complex medical reasoning capabilities.  
* **Gap Analysis**: There is a critical lack of comprehensive medical knowledge integration beyond imaging, a susceptibility to hallucinations in current models, and an absence of tailored reasoning for complex clinical scenarios. Furthermore, evaluations are often conducted in isolated, non-standardized environments.  
* **Contributions**:  
  * Developed **Lingshu**, a generalist medical MLLM in 7B and 32B configurations.  
  * Proposed a robust **data curation procedure** that curates diverse medical knowledge and synthesizes high-quality reasoning samples.  
  * Introduced **MedEvalKit**, a unified framework for standardized and fair model assessment across multimodal and textual benchmarks.  
  * Explored reinforcement learning with verifiable rewards (**RLVR**) to boost medical reasoning.  
* **Methodologies**: The model is based on the **Qwen2.5-VL** architecture. It follows a progressive **multi-stage training paradigm**: (1) Medical Shallow Alignment (tuning vision encoder/projector), (2) Medical Deep Alignment (full parameter tuning with enriched data), (3) Medical Instruction Tuning (task-specific alignment), and (4) Medical-oriented Reinforcement Learning (using GRPO).  
* **Equations**: While specific model architectures like the Transformer and the AdamW optimizer are used, the paper focuses on loss functions for instruction tuning and RL rewards. Specifically, it mentions an **accuracy-oriented reward** and a **strict format reward** used during the GRPO stage.  
* **Results/Objective Reached**: Lingshu-32B consistently achieved state-of-the-art performance, surpassing leading open-source models and proprietary systems like GPT-4 on medical VQA benchmarks. It demonstrated practical utility in case studies for diagnosis, report generation, and medical consultation.  
* **Future Works**: Directions include natively supporting ultra-high-resolution 3D imaging (CT, MRI) and omics data; developing specialized medical reward functions for RL; and introducing domain-specific measures like the Clinical Efficacy Score.

The following summary details the research paper **"Med3DVLM: An Efficient Vision-Language Model for 3D Medical Image Analysis."**

* **Title**: Med3DVLM: An Efficient Vision-Language Model for 3D Medical Image Analysis.  
* **Literature Review**: Vision-language models (VLMs) like CLIP and LLaVA have successfully improved versatility in clinical settings by aligning 2D medical images with textual reports. While models like PMC-CLIP and RadFM have attempted to bridge the gap to 3D imaging, they often struggle with volumetric context or are primarily optimized for simple text generation tasks. The M3D-LaMed model recently established a state-of-the-art generalist multi-modal model for 3D analysis but faces high computational costs and relies on contrastive loss that requires large negative batches.  
* **Gap Analysis**: Extending VLMs to 3D imaging is hindered by the extreme computational complexity of volumetric data, a loss of global context in slice-by-slice analysis, and a scarcity of publicly available 3D image-report pairs. Furthermore, current fusion mechanisms may not adequately capture complex cross-modal interactions.  
* **Contributions**:  
  * **DCFormer**: An efficient 3D encoder that uses decomposed 3D convolutions to capture fine-grained spatial features at scale.  
  * **SigLIP**: A contrastive learning strategy using pairwise sigmoid loss that improves image-text alignment without requiring large negative batches.  
  * **Dual-stream MLP-Mixer**: A projector that effectively fuses low- and high-level image features with text embeddings for richer representations.  
  * **Public Release**: The model's code is publicly available for research use.  
* **Methodologies**:  
  * The model architecture consists of a **DCFormer-small** vision encoder, an **MLP-Mixer** multi-modal projector, and a **Qwen2.5-7B-Instruct** large language model.  
  * Training is conducted in three stages: contrastive pretraining using SigLIP, multi-modal projector pretraining (while other weights are frozen), and final VLM fine-tuning using Low-Rank Adaptation (LoRA).  
  * The DCFormer decomposes 3D convolutions into three parallel 1D convolutions (depth, height, and width) to reduce computational complexity.  
* **Equations**:  
  * **DCFormer decomposition**: $X\_{h}^\*=DWConv\_{C\\rightarrow C}^{k\_{h}\\times1\\times1}(X)$ (with similar operations for width and depth).  
  * **SigLIP Loss**: $\\mathcal{L}*{SigLIP}=-\\frac{1}{|B|}\\sum*{i=1}^{|B|}\\sum\_{j=1}^{|B|}log\\frac{1}{1+e^{z\_{ij}(-tx\_{i}y\_{j}+b)}}$.  
  * **LoRA update**: $W=W\_{0}+\\Delta W$ where $\\Delta W=AB$.  
* **Results/Objective Reached**:  
  * Med3DVLM achieved superior performance on the M3D dataset, reaching **61.00% R@1** for image-text retrieval, compared to 19.10% for M3D-LaMed.  
  * In report generation, it achieved a **METEOR score of 36.42%** (vs. 14.38%).  
  * For open-ended VQA, it scored **36.76% METEOR**, and for closed-ended VQA, it reached **79.95% accuracy**.  
* **Future Works**: Future directions include incorporating other imaging modalities like **MRI and ultrasound** and validating the model across diverse clinical datasets and protocols to ensure real-world reliability. Researchers also aim to incorporate **structured clinical knowledge** to reduce hallucinations and expand the model to support **uncertainty-aware** response generation.

Based on the provided research paper, here is the summary for **MedFrameQA**:

* **Title**: MedFrameQA: A Multi-Image Medical VQA Benchmark for Clinical Reasoning.  
* **Literature Review**:  
  * Multimodal Large Language Models (MLLMs) are increasingly used in medical domains for diagnostics.  
  * Current medical benchmarks primarily focus on isolated, single-frame interpretation (e.g., SLAKE, VQA-RAD).  
  * Recent multi-image benchmarks (e.g., MedXpertQA) often treat images as independent clues rather than complementary views of a coherent clinical scenario.  
* **Gap Analysis**: There is a significant lack of benchmarks that test multi-image comparative reasoning, which is essential for real-world clinical practice where clinicians synthesize findings across different views, modalities, or time points.  
* **Contributions**:  
  * Introduced **MedFrameQA**, the first benchmark specifically designed for multi-image medical VQA.  
  * Developed a scalable pipeline to construct high-quality VQA pairs from medical education videos.  
  * Provided a dataset of **2,851 multi-image VQA pairs** with explicit, transcript-grounded reasoning chains.  
  * Established a rigorous standard for evaluating MLLMs' ability to handle complex medical narratives.  
* **Methodologies**:  
  * **Data Collection**: Curated 1,971 high-resolution medical education videos from YouTube using 114 clinical search queries.  
  * **Frame-Caption Pairing**: Extracted keyframes and aligned them with transcribed audio captions using Whisper and GPT-4o.  
  * **Multi-Frame Merging**: Merged adjacent frame-caption pairs into "clips" (2-5 frames) when they described the same clinical concept.  
  * **VQA Generation**: Instructed GPT-4o to generate challenging multiple-choice questions requiring cross-image synthesis.  
  * **Filtering**: Applied two-stage automated (difficulty filtering) and manual (quality/privacy review) filtering.  
* **Equations**: The paper defines the refined caption ($C\_{i}$) using GPT-4o and a rephrasing prompt ($I\_{rephrase}$):  
  * $C\_{i} \= GPT-4o(\\tilde{C}*{i}, F*{i} | I\_{rephrase})$.  
* **Results / Objective Reached**:  
  * Evaluation of 11 advanced MLLMs showed most accuracies fall **below 50%**.  
  * **Gemini-2.5-Flash** achieved the highest accuracy (54.75%).  
  * Accuracies fluctuated with increasing frame counts, suggesting performance depends more on information complexity than image volume.  
* **Future Works**: Future research will focus on developing strategies to enhance multi-image reasoning capabilities and obtaining full-scale physician evaluation for broader verification of clinical correctness.

The following summary covers the research paper titled **"Medical Knowledge-Based Differential Image Visual Question Answering."**

* **Title**: Medical Knowledge-Based Differential Image Visual Question Answering.  
* **Literature Review**:  
  * Visual Question Answering (VQA) has evolved significantly since 2014, categorized into classification and generation tasks.  
  * Early methods utilized feature concatenation or addition, while subsequent advancements introduced Bayesian-based models, attention mechanisms (e.g., MUTAN, FVTA, CAAN), and graph reasoning (e.g., ReGAT).  
  * Medical VQA (Med-VQA) adapted these techniques but faced challenges due to limited annotated data, leading to the use of meta-learning (MEVF, MMQ, KEML), conditional reasoning (CPCR), and transfer learning (CPRD).  
* **Gap Analysis**:  
  * Most Med-VQA models focus on extracting information from single images, which fails to assist in clinical scenarios that require comparing multiple images to assess therapeutic efficacy or disease progress.  
  * Existing models often overlook inherent disease-related information and the professional medical knowledge necessary for specialized queries.  
* **Contributions**:  
  * Proposed **MKG-Diff-VQA**, a framework that supports multiple image inputs and incorporates external medical knowledge.  
  * Constructed a **medical knowledge graph (MKG)** specifically for differential VQA to capture disease-related relationships and attributes.  
  * Introduced a prototype for differential Med-VQA that enables comparison between primary and reference images.  
* **Methodologies**:  
  * **Feature Encoding Module**: Uses Faster R-CNN for anatomical structure extraction from images, GRU-based RNNs for question embedding, and graph convolutional networks (GCN) for medical knowledge cluster embedding.  
  * **Feature Processing Module**: Fuses multimodal features using modular co-attention networks (MCAN) and a prior knowledge-guided change locator to measure differences between images.  
  * **Answer Generation Module**: Employs an LSTM-based decoder to generate final answers word-by-word.  
* **Equations**:  
  * **Differential Feature Calculation**: $F\_{diff} \= F\_{main} \- F\_{ref}$.  
  * **Disease Node Embedding Update**: $D^{l} \= D^{l-1} \+ C\_{D}^{Att}(A^{l-1}W\_{AD})$.  
  * **Multimodal Fusion**: $f\_{vq} \= GAP(G\_{spa}(f) \+ G\_{sem}(f) \+ G\_{imp}(f))$.  
* **Results/Objective Reached**:  
  * The model achieved a **BLEU-4 score of 0.478** and a **ROUGE\_L score of 0.608**, outperforming baseline models like MMQ and EKAID.  
  * A qualitative evaluation by clinical doctors showed an accuracy rate of **62.3%** on 300 randomly selected image pairs.  
* **Future Works**:  
  * Integrating contextual embeddings like **BERT** to handle specialized medical terminology and abbreviations better.  
  * Expanding the dataset and knowledge graph to include more diseases, symptoms, and varied imaging modalities such as **CT and MRI**.  
  * Exploring large-scale pre-training models (e.g., **GPT, CLIP**) to further enhance reasoning capabilities and reduce training time.

The following summary is for the paper **"MedRAX: Medical Reasoning Agent for Chest X-ray."**

* **Title**: MedRAX: Medical Reasoning Agent for Chest X-ray.  
* **Literature Review**: Traditional AI in clinical practice has relied on task-specific models for aspects like classification, segmentation, and report generation. While foundation models (FMs) such as GPT-4 and LLaVA-Med have advanced medical image-text reasoning, they often suffer from hallucinations, inconsistent reasoning, and a lack of transparency. Current medical agents like MDAgents and MMedAgent face challenges such as high computational overhead or the need for retraining to integrate new tools.  
* **Gap Analysis**: Existing chest X-ray (CXR) solutions are often fragmented, operating in isolation, which hinders widespread clinical adoption. There is a lack of specialized AI agents that can dynamically orchestrate multiple specialized tools for complex, multi-step medical queries while maintaining the transparency and reliability required for high-stakes medical applications.  
* **Contributions**:  
  * **MedRAX**: A specialized AI agent framework that integrates multiple CXR analysis tools without additional training.  
  * **ChestAgentBench**: A comprehensive benchmark of 2,500 complex medical queries derived from 675 expert-curated clinical cases.  
  * **Performance**: Demonstrated state-of-the-art performance, outperforming both general-purpose and specialized biomedical models.  
  * **Interface**: Developed a user-friendly Gradio interface for flexible clinical deployment.  
* **Methodologies**: MedRAX utilizes a **ReAct (Reasoning and Acting)** loop driven by a Large Language Model (LLM) core. The system iterates through cycles of **Observation** (analyzing query and state), **Thought** (determining actions), and **Action** (executing tools). It integrates a toolbox of specialized models for VQA (CheXagent, LLaVA-Med), segmentation (MedSAM, ChestX-Det), grounding (Maira-2), report generation (BERT-based decoder), and classification (TorchXRayVision).  
* **Equations**: While the paper primarily uses algorithmic logic, it employs a **ReAct cycle** represented by the iterative process:  
  * $thoughts \= Reason(state, M)$  
  * $results \= ExecuteParallel(tools, state)$  
  * $M \= M \\cup {(thoughts, tools, results)}$  
* **Results/Objective Reached**: MedRAX achieved an overall accuracy of **63.1%** on ChestAgentBench, significantly outperforming GPT-4o (56.4%) and CheXagent (39.5%). It also reached **90.35% accuracy** on the SLAKE VQA benchmark. Case studies confirmed its ability to resolve conflicting tool outputs and break down complex queries into targeted analytical steps.  
* **Future Works**: Future research will focus on optimizing tool selection balance, investigating reinforcement learning to reduce hallucinations, and implementing uncertainty-aware reasoning. The authors also plan to expand the framework's capabilities to other multimodal medical imaging domains for greater clinical impact.

Based on the provided research paper, here is the summary for **MedThink**:

* **Title**: MedThink: Explaining Medical Visual Question Answering via Multimodal Decision-Making Rationale.  
* **Literature Review**:  
  * Medical Visual Question Answering (MedVQA) provides natural language responses to clinical queries about medical images.  
  * Previous solutions relied on CNNs (e.g., ResNet) for visual features and RNNs for text, while more recent works have transitioned to transformer-based models.  
  * Many existing methods treat MedVQA as a classification problem with predefined options, which does not reflect real-world clinical practice.  
  * While Multimodal Large Language Models (MLLMs) show promise, their high operational costs and latency make them impractical for direct clinical use.  
* **Gap Analysis**:  
  * Current MedVQA datasets often lack intermediate reasoning steps between question and answer, leading to "black-box" models with limited interpretability.  
  * Manual annotation of reasoning rationales is extremely time-consuming and requires specialized medical expertise.  
* **Contributions**:  
  * **R-RAD, R-SLAKE, and R-Path**: The first MedVQA benchmark datasets that encompass intermediate reasoning rationales.  
  * **Semi-automated Annotation Process**: A streamlined workflow using MLLMs (like GPT-4V) and human expert verification to generate rationales efficiently.  
  * **MedThink Framework**: A lightweight (223M parameters) generative framework that balances accuracy and cost-effectiveness while providing enhanced interpretability.  
* **Methodologies**:  
  * **Architecture**: Composed of a TextualEncoder, VisualEncoder (DETR), Cross-Attention Network, Gated Fusion Network, and TextualDecoder (all based on Transformer architecture).  
  * **Medical Decision-Making Rationales (MDMRs)**: Incorporates intermediate reasoning steps, including image descriptions and background medical knowledge, into the training process.  
  * **Generation Strategies**: Proposed three modes: **Explanation** (Answer first, then Rationale), **Reasoning** (Rationale first, then Answer), and **Two-Stage Reasoning** (Phased strategy with two independent models).  
* **Equations**:  
  * **Attention-guided Visual Feature**: $H\_{attn}^I \= Softmax(\\frac{QK^T}{\\sqrt{d}})V$.  
  * **Fusion Coefficient**: $\\lambda \= Sigmoid(W\_lF\_Q \+ W\_vH\_{attn}^I)$.  
  * **Fused Output**: $F\_{fuse} \= (1 \- \\lambda) \\cdot F\_T \+ \\lambda \\cdot H\_{attn}^I$.  
  * **Loss Function (Negative Log-Likelihood)**: $L \= \-\\sum\_{n=1}^N \\log p(Y\_n|X, Y^{1:n-1})$.  
* **Results / Objective Reached**:  
  * Achieved accuracies of **83.5% on R-RAD**, **86.3% on R-SLAKE**, and **87.2% on R-Path**, significantly exceeding state-of-the-art models with comparable parameters.  
  * Ablation studies showed that expert involvement and advanced MLLMs in dataset creation positively impact model accuracy.  
* **Future Works**:  
  * Exploration of generative models specifically tailored for real clinical settings.  
  * Development of improved methods for evaluating MedVQA model performance in open-ended scenarios.

This summary provides an overview of the research paper titled **"MiniGPT-4: Enhancing Vision-Language Understanding with Advanced Large Language Models."**

* **Title**: MiniGPT-4: Enhancing Vision-Language Understanding with Advanced Large Language Models  
* **Literature Review**: Large language models (LLMs) have recently made significant strides, demonstrating a capacity for diverse linguistic tasks in a zero-shot manner. Research in vision-language tasks has increasingly utilized autoregressive language models as decoders, with notable examples like Flamingo, BLIP-2, and PaLM-E. These models leverage pre-trained components to share knowledge between multimodal and language domains.  
* **Gap Analysis**: While GPT-4 has shown remarkable multimodal capabilities—such as generating websites from handwritten drafts—its technical details remain undisclosed. Furthermore, traditional vision-language models like BLIP-2, which use less powerful language models, lack these advanced emergent abilities.  
* **Contributions**:  
  * **MiniGPT-4 Model**: Introduced a model that aligns a frozen visual encoder with a frozen advanced LLM (Vicuna) using a single projection layer.  
  * **Emergent Multi-modal Abilities**: Demonstrated for the first time that proper alignment with an advanced LLM can unlock GPT-4-like capabilities, such as detailed image description and website creation from drafts.  
  * **High-Quality Dataset**: Curated a detailed image description dataset to fine-tune the model, improving language naturalness and usability.  
* **Methodologies**:  
  * **Architecture**: Combines a vision encoder (pretrained ViT and Q-Former from BLIP-2) with the Vicuna LLM via a linear projection layer.  
  * **Two-Stage Training**:  
    * **Stage 1 (Pre-training)**: Trained for 20,000 steps on approximately 5 million image-text pairs from LAION, Conceptual Captions, and SBU to align visual features.  
    * **Stage 2 (Fine-tuning)**: Finetuned using 3,500 high-quality, manually verified image descriptions to correct linguistic issues like repetition and fragmentation.  
* **Equations**: The paper does not provide specific mathematical formulas but describes the objective as using the linear projection layer's output as a **soft prompt** for the LLM to generate corresponding ground-truth texts.  
* **Results/Objective Reached**: MiniGPT-4 successfully replicated GPT-4’s advanced abilities, including meme interpretation and recipe generation. Quantitatively, it outperformed BLIP-2 in advanced tasks, satisfying approximately 65% of human requests compared to BLIP-2's 5%. It also showed a 66.2% correctness rate in image captioning information coverage.  
* **Future Works**: The authors suggest future research should investigate the mechanisms of **compositional generalization** and explore ways to enhance these capabilities. They also aim to improve performance on traditional vision benchmarks through refined training strategies and additional learnable parameters.

Based on the provided research paper, here is the summary for **MiniGPT-Med**:

* **Title**: MiniGPT-Med: A Unified Vision-Language Model for Radiology Image Understanding.  
* **Literature Review**: Recent advances in Generative Pretraining have led to the emergence of powerful multimodal models like GPT-4 and Gemini. In the medical sector, specialized models such as Med-Flamingo and XrayGPT have shown promise in tasks like report generation and VQA but often lack broader versatility. Other benchmarks in the field include CheXagent, CheXpert, and MedKLIP, which focus on specific interpretation tasks like chest pathology detection or medical knowledge-enhanced pre-training.  
* **Gap Analysis**: Despite the progress of Multi-modal Large Language Models (LLMs), their adoption in the medical sector is limited due to the specific requirements for data complexity and sensitivity. Existing medical models are often highly specialized for particular tasks, leading to a lack of versatility. For example, many current models lack essential visual grounding skills required for disease detection.  
* **Contributions**:  
  * Introduced **MiniGPT-Med**, a unified vision-language model adapted for medical applications through domain-specific fine-tuning.  
  * Developed a model that supports heterogeneous radiological modalities (X-rays, CT, MRIs) and diverse tasks, including disease detection, medical VQA, and report generation, within a single task identifier framework.  
  * Achieved state-of-the-art performance in medical report generation, outperforming specialized baselines like CheXagent and generalist models like Gemini in BERT-Sim scores.  
  * Publicly released the model and code to assist in reducing the gap in radiology practice.  
* **Methodologies**:  
  * **Architecture**: Combines an EVA vision backbone, a linear projection layer, and a LLaMA-2 (7B) language model.  
  * **Vision-Language Alignment**: Merges four adjacent visual tokens into a single embedding to reduce sequence length and enhance computational efficiency without losing critical spatial interactions.  
  * **Task Identifiers**: Incorporates distinct identifiers (e.g., \[caption\], \[vqa\], \[detection\]) to handle diverse tasks and mitigate hallucinations in a multi-task environment.  
  * **Training**: Initially freezes the vision encoder while fine-tuning the projection layer and the LLM using LoRA on five curated medical datasets: MIMIC, NLST, SLAKE, RSNA, and RadVQA.  
* **Equations**: While specific mathematical formulas are not explicitly written out, the paper utilizes standard metrics and training strategies:  
  * **Training Loss**: The model is trained using cross-entropy loss.  
  * **Evaluation Metrics**: Diagnostic accuracy is measured using BERT Similarity (BERTsim), CheXbert Similarity (CheXbert-Sim), and Intersection over Union (IoU) for grounding tasks.  
* **Results/Objective Reached**:  
  * **Report Generation**: Surpassed the strongest specialist baseline (CheXagent) by 21.6 points and the strongest generalist (Gemini) by 12 points in BERT-Sim.  
  * **Disease Detection**: Achieved an IoU score of 0.26 on the RSNA benchmark, exceeding generalist models by a 16% margin.  
  * **VQA**: Achieved a 0.58 BERT-Sim score on RadVQA, matching or exceeding several specialized and generalist models.  
  * **Expert Review**: Radiologists rated 65.48% of generated reports as "Good," the highest among compared models.  
* **Future Works**: Future plans involve incorporating more diverse medical datasets and improving the model's understanding of complex medical terminology. The researchers also aim to enhance the model's interpretability and dependability and conduct extensive clinical validation studies to ensure safety and effectiveness in real-world healthcare environments.

Based on the provided research paper, here is the summary for **MMBERT**:

* **Title**: MMBERT: Multimodal BERT Pretraining for Improved Medical VQA.  
* **Literature Review**:  
  * Supervised learning for Medical Visual Question Answering (Med-VQA) is often hindered by the small size of existing datasets.  
  * Previous winning solutions for challenges like VQA-Med 2019 used combinations of CNNs for image features and BERT for text, followed by co-attention fusion.  
  * While effective, these earlier methods did not utilize existing large, unlabelled multimodal medical datasets to learn superior semantic representations.  
* **Gap Analysis**: General domain VQA models cannot be directly applied to medicine due to fundamental differences in image data distributions. Furthermore, medical image annotation is a costly, time-consuming process requiring expert involvement, which limits the availability of large-scale labeled datasets.  
* **Contributions**:  
  * Proposed **MMBERT**, a solution inspired by self-supervised pretraining of Transformer-style architectures.  
  * Achieved new state-of-the-art performance on two radiology benchmarks: **VQA-Med 2019** and **VQA-RAD**.  
  * Demonstrated that a single model could outperform previous ensemble models and dedicated question-specific models.  
  * Provided **attention maps** to enhance model interpretability.  
* **Methodologies**:  
  * **Architecture**: A Transformer encoder with 4 BERT layers and 12 attention heads.  
  * **Pretraining**: Conducted on the **ROCO dataset** using a Masked Language Modeling (MLM) task where only medical keywords in captions were masked.  
  * **Input Features**: Combines text token embeddings with image features extracted from different convolutional layers of a **ResNet152**.  
  * **Finetuning**: The pretrained weights are further tuned on target VQA datasets.  
* **Equations**:  
  * **Self-Attention**: $Attention(Q,K,V)=softmax(\\frac{QK^{T}}{\\sqrt{d\_{k}}})V$.  
* **Results/Objective Reached**:  
  * On **VQA-Med 2019**, the "MMBERT Exclusive" model reached **67.2% overall accuracy**, a 5% improvement over previous bests.  
  * On **VQA-RAD**, "MMBERT General" achieved **72.0% accuracy**, surpassing models that utilized dedicated architectures for different question types.  
  * Attention maps confirmed the model correctly focused on relevant anatomical features, such as grey/white matter for modality prediction.  
* **Future Works**: The paper notes that current quantitative protocols do not account for **differential diagnoses** that human experts might provide; future work could consider these clinical nuances. (Note: The provided text focuses primarily on the completed study and results).

### **MultiMedEval: A Benchmark and a Toolkit for Evaluating Medical Vision-Language Models**

**Literature Review**

General-purpose vision-language models (VLMs) like GPT-4V and Gemini are benchmarked using toolkits such as OpenAI Evals or the OpenVLM Leaderboard. However, adapting these to the medical domain is challenging due to proprietary datasets and the need for fine-grained knowledge. While recent specialized models like LLaVA-Med, PMC-VQA, and RadFM have emerged, their evaluation remains non-uniform, using different datasets and non-overlapping metrics (e.g., BLEU vs. F1), which prevents direct comparison.

**Gap Analysis**

Existing medical VLM research suffers from three critical issues:

* **Non-uniformity**: Models are tested using inconsistent metrics and tasks.  
* **Closed-source Benchmarks**: Holistic evaluations of state-of-the-art models (e.g., MedPaLM M) are often closed-source, hindering replication.  
* **Complexity**: Implementing evaluation pipelines from diverse datasets to complex metrics is time-consuming and cumbersome for researchers.

**Contributions**

The authors introduce **MultiMedEval**, an open-source Python-based toolkit that provides:

* A unified framework for fair and reproducible evaluation across **six tasks** and **23 datasets**.  
* Coverage of **11 medical domains** and modalities.  
* A simplified interface requiring only a few lines of code to evaluate any VLM.

**Methodologies**

The toolkit abstracts the data download, preprocessing, and metric computation. Users implement a "batcher" Callable to wrap their model's inference. Evaluation can be zero-shot or few-shot. Tasks include:

* **Image Classification**: 15 datasets; uses BLEU for class selection and reports F1, AUROC, and accuracy.  
* **QA/VQA**: Uses BLEU and tokenized precision/recall for answer extraction.  
* **Report Generation/Summarization**: Employs n-gram metrics (BLEU, ROUGE-L) and domain-specific metrics like F1-RadGraph and RadCliQ.  
* **NLI**: Categorizes sentence relationships into contradiction, entailment, or neutral.

**Equations**

While specific mathematical formulas for standard metrics (like BLEU or F1) are not explicitly written out in the text, the paper defines **RadCliQ** as a composite metric of ROUGE-L, BLEU, F1-RadGraph, and CheXBert vector similarity. Accuracy for VQA is determined by specific recall thresholds: **$\\ge$ 0.5** for close-ended and **$\\ge$ 0.75** for open-ended questions.

**Results / Objective Reached**

The authors successfully benchmarked two open-source models (RadFM, LLaVA-Med) and compared them against reported results for closed-source models. Key findings include:

* Closed models (MAIRA-1, MedPaLM M) generally outperform open-source ones.  
* BiomedGPT shows competitive performance, even outperforming MedPaLM M in some classification tasks (Macro-F1 on CBIS-DDSM).  
* The benchmark confirms significant gaps in current medical VLM evaluation consistency.

**Future Works**

MultiMedEval will be actively maintained with new tasks and datasets. The authors plan to collaborate with libraries like **MONAI** and **MLCommons** to increase community adoption and standardization.

**Multimodal Large Language Models for Medicine: A Comprehensive Survey**

**Literature Review**

Large Language Models (LLMs) evolved from statistical and neural models to architectures like Transformer, which enabled massive parameter scaling for tasks such as text extraction and sentiment analysis. In healthcare, LLMs have been utilized to process electronic health records (EHR) and doctor-patient conversations. However, medical data is inherently multimodal, spanning text, images, videos, audio, and omics. This led to the emergence of Multimodal Large Language Models (MLLMs), which integrate LLM cores with modality-specific encoders and alignment modules to address complex clinical tasks.

**Gap Analysis**

While general MLLMs like GPT-4 have gained attention, their direct application in medicine faces challenges regarding unsteady accuracy and professional requirements. Single-modal LLMs are restricted because clinical settings require processing diverse data types simultaneously. Furthermore, current medical MLLMs often suffer from "hallucinations" due to insufficient data alignment or over-reliance on linguistic stereotypes over visual evidence.

**Contributions**

This survey reviews 330 recent papers to summarize the evolutionary pathway of medical MLLMs. It categorizes applications into medical reporting, diagnosis, and treatment. The paper also provides a comprehensive compilation of six mainstream data modes, corresponding evaluation benchmarks, and professional requirements such as fairness and transparency.

**Methodologies**

MLLMs typically utilize a pre-trained LLM (e.g., LLaMA, Vicuna) as a core, connected to vision or audio encoders via an alignment module (like an MLP or Q-Former) that maps various features into a shared embedding space. Pre-training tasks include Image-Text Contrastive (ITC) learning to bridge modalities and combinations of Masked Language Modeling (MLM) and Masked Image Modeling (MIM) to learn structural relationships.

**Equations**

While the survey focuses on qualitative analysis, it describes the use of **cosine distance** as a mathematical metric in ITC tasks to assess similarity between text and image embeddings.

**Results / Objective Reached**

The survey demonstrates that MLLMs have achieved state-of-the-art (SOTA) performance in specialized tasks like radiology report generation (e.g., Radiology-Llama2) and surgical assistance (e.g., SurgicalGPT). It concludes that specialized medical fine-tuning significantly improves model performance over general-purpose models in clinical scenarios.

**Future Works**

Future research must address "catastrophic forgetting" during continuous fine-tuning with rapidly updated medical data. Additionally, efforts are needed to enable edge deployment on low-resource devices and to implement robust privacy-preserving techniques like federated learning and differential privacy.

**Title:** Multimodal Large Language Models in Medical Imaging: Current State and Future Directions.

**Literature Review:**

Deep learning, particularly convolutional neural networks, has significantly enhanced image recognition and segmentation in radiology. However, traditional AI applications often analyze images in isolation, contrasting with real-world clinical practice where practitioners combine imaging findings with electronic health records (EHRs), laboratory results, and patient history. Multimodal Large Language Models (MLLMs) have emerged to bridge this gap by integrating Large Language Models (LLMs) with advanced computer vision modules. These models leverage transformer architectures and vision transformers (ViTs) to process heterogeneous data types simultaneously.

**Gap Analysis:**

A primary limitation in medical AI is the unimodal approach of earlier systems which ignore the inherently multimodal nature of radiological practice. While MLLMs show promise, they face significant hurdles: a scarcity of large-scale, high-quality multimodal medical datasets, risks of "hallucinated" findings, a lack of transparency in decision-making ("black box" nature), and high computational demands. Furthermore, standard evaluation metrics like BLEU or ROUGE often fail to capture clinically relevant outcomes or factual consistency.

**Contributions:**

This review provides a comprehensive overview of the architectural and training paradigms of MLLMs in radiology. It details the transition from 2D to 3D imaging models and identifies key clinical applications such as automatic radiology report generation (RRG) and visual question answering (VQA). The paper also outlines critical advancements like region-grounded reasoning and the development of robust medical foundation models (FMs).

**Methodologies:**

The paper discusses a typical MLLM architecture comprising a pre-trained encoder (e.g., CLIP), a pre-trained LLM "cognitive engine," and a multimodal connector (projection, query, fusion, or expert-driven) to align representations. Training involves three sequential stages: pre-training for modality alignment, instruction tuning to follow complex directives, and alignment tuning to optimize outputs based on human preferences.

**Equations:**

The provided text does not explicitly detail mathematical equations; however, it references the use of bidirectional contrastive loss in models like ConVIRT to pull matched image-report pairs together and push mismatched pairs apart in the embedding space.

**Results / Objective Reached:**

The review establishes that MLLMs can successfully integrate diverse clinical and imaging data to support complex tasks like generating preliminary radiology reports that are sometimes preferred over human-drafted ones. Models such as Med-PaLM M and LLaVA-Med have reached state-of-the-art performance in specialized biomedical benchmarks.

**Future Works:**

Future research should prioritize incorporating region-grounded reasoning to link outputs to specific image areas. There is also a need to develop standardized, domain-specific evaluation metrics (e.g., RadGraph, GREEN) and established regulatory frameworks for safe clinical integration. Explorations into Vision-Language-Action (VLA) frameworks for embodied AI and collaborative multi-agent systems represent the next frontier.

**Title**: PathologyVLM: A Large Vision-Language Model for Pathology Image Understanding

**Literature Review**: Traditional AI in pathology has focused on task-specific models for metastasis detection and cancer subtyping. Recently, Large Vision-Language Models (VLMs) like LLaVA have shown promise by aligning multimodal inputs for general reasoning. In the medical sector, models such as LLaVA-Med, PathChat, and Quilt-LLaVA have emerged, utilizing datasets like PMC-15M and Quilt-1M to enhance clinical image understanding.

**Gap Analysis**: General-domain VLMs often provide incorrect answers or "hallucinations" in specialized medical fields. Furthermore, existing medical models frequently rely on proprietary, non-open-source data, hindering reproducibility. Many of these models also lack architectural improvements at the model level, often losing detailed features during standard image scaling.

**Contributions**:

* Constructed a high-quality human pathology image-text dataset by cleaning public medical data.  
* Developed **PathologyVLM**, featuring a specialized **PLIP** visual encoder and a **scale-invariant connector** to prevent information loss from image scaling.  
* Open-sourced the codebase, instruction-following data, and model checkpoints.

**Methodologies**: The model uses a three-stage learning process: (1) training a **Pathology Language-Image Pretraining (PLIP)** model for visual encoding, (2) domain alignment for the LLM using image-caption pairs, and (3) instruction fine-tuning for Visual Question Answering (VQA). The architecture integrates a PLIP vision encoder, a learnable connector, and a Llama3-based LLM.

**Equations**:

* **Image-Text Contrastive (ITC) Loss**: $\\mathcal{L}*{itc} \= \\frac{1}{N} \\sum*{i=1}^{N} \\log \\frac{\\exp(\\text{sim}(V\_i^T, V\_i^I)/\\tau)}{\\sum\_{j=1}^{N} \\exp(\\text{sim}(V\_i^T, V\_j^I)/\\tau)}$.  
* **Image-Text Matching (ITM) Loss**: $\\mathcal{L}*{itm} \= \-\\frac{1}{3N} \[\\sum*{i=1}^{N} \\log P(y\_i=1|V\_i^{I\_{pos}T}) \+ \\sum\_{i=N+1}^{3N} \\log P(y\_i=0|V\_i^{I\_{neg}T})\]$.  
* **Language Modeling (LM) Loss**: $\\mathcal{L}*{LLM} \= \\sum*{i=1}^{N} \\sum\_{t=1}^{T\_i} \\log P(w\_{i,t} | w\_{i,1:t-1}; \\theta)$.

**Results / Objective Reached**: PathologyVLM achieved the best overall performance among multimodal models of similar scale, significantly outperforming general LLaVA and other medical-domain models in both supervised and zero-shot VQA tasks. In supervised PathVQA tests, it achieved an accuracy of 92.51%, surpassing medical experts who scored 71.15%.

**Future Works**: Future efforts will focus on improving the quality of pathology image descriptions, as current data from the internet varies in correctness. The authors also aim to address unbalanced data distributions across different organs to improve comprehensive model performance.

**Title:** PMC-VQA: Visual Instruction Tuning for Medical Visual Question Answering.

**Literature Review:** Large language models (LLMs) like GPT-4 and Med-PaLM have shown success in medical natural language processing but remain "blind" to visual modalities. Existing Medical Visual Question Answering (MedVQA) methods often treat the problem as a retrieval task with a finite set of outcomes, limiting their clinical utility. While vision-language models like Flamingo and BLIP exist, they are primarily trained on natural images and struggle with the nuanced visual concepts found in medical scenarios.

**Gap Analysis:** The field faces two primary obstacles:

* **Methodological Limitations:** Most current MedVQA systems use a retrieval-based approach rather than an open-ended generative one.  
* **Data Scarcity:** Existing MedVQA datasets are limited in size and modality diversity, making them insufficient for training high-performing generative models.

**Contributions:**

* Reframing MedVQA as a generative learning task.  
* Introducing **PMC-VQA**, a large-scale dataset with 227k VQA pairs across 149k images.  
* Proposing **MedVInT**, a generative model obtained through visual instruction tuning.  
* Establishing a new, manually verified, and more challenging test set for thorough evaluation.

**Methodologies:** The researchers developed a scalable pipeline to automatically generate VQA pairs from 381k image-caption pairs in the PMC-OA dataset using ChatGPT. They implemented two model variants: **MedVInT-TE** (tailored for encoder-based language models) and **MedVInT-TD** (tailored for decoder-based LLMs). Training involves aligning a pre-trained vision encoder (ResNet-50) with an LLM (such as PMC-LLaMA) via a projection module.

**Equations:** The model is trained by maximizing the probability of generating the ground-truth answer ($a$) given the input image ($I$) and question ($q$), expressed via a negative log-likelihood loss function:

$$\\mathcal{L}(\\Theta)=-\\sum\_{t=1}^{T}log\\ p(a^{t}|\\mathcal{I},q^{1:T},a^{1:t-1};\\Theta)$$.

**Results / Objective Reached:** MedVInT achieved state-of-the-art performance on public benchmarks (VQA-RAD, SLAKE, and ImageClef-2019), significantly outperforming previous methods in generating accurate free-form answers. Pre-training on PMC-VQA specifically provided a substantial performance boost, such as a 16% accuracy increase for open-ended questions on VQA-RAD.

**Future Works:** The authors plan to explore more effective evaluation metrics for generative models that capture sentence fluency beyond simple string similarity. They also aim to address current limitations regarding model "hallucinations" in adversarial or out-of-scope cases to better prepare the system for real clinical applications.

**Title:** Pretraining Vision-Language Model for Difference Visual Question Answering in Longitudinal Chest X-rays

**Literature Review:** Difference visual question answering (diff-VQA) is vital for radiologists to track disease progression by comparing images over time. While general vision-language models (VLMs) have gained popularity for medical image interpretation, previous diff-VQA research focused primarily on designing specific network architectures rather than leveraging the power of pretrained VLMs.

**Gap Analysis:** Prior works missed opportunities to enhance performance by utilizing VLMs pretrained on vast natural or medical datasets. Consequently, there has been a lack of effective pretraining pipelines specifically designed for diff-VQA that investigate the impact of longitudinal data composition and temporal information.

**Contributions:** The authors introduce **PLURAL**, a novel VLM pretrained on natural and longitudinal chest X-ray data. Key contributions include a step-by-step training approach that transfers knowledge from general domains to specialized longitudinal medical data and the release of an open-source codebase.

**Methodologies:** PLURAL utilizes a Transformer-based encoder-decoder architecture modified with a new input branch to process a past and current image simultaneously. The model undergoes three training stages:

* **Stage 1:** Pretraining on natural images and texts.  
* **Stage 2:** Pretraining on longitudinal chest X-rays using QA pairs and radiologist reports (Findings and Impression sections).  
* **Stage 3:** Finetuning specifically on diff-VQA data.

**Equations:** The model uses time encoding to differentiate image time points:

* $v\_{trans}^{past} \= P\_{img}(v\_{past}) \+ p\_{enc}^{img} \+ t\_{enc}^{past}$  
* $v\_{trans}^{cur} \= P\_{img}(v\_{cur}) \+ p\_{enc}^{img} \+ t\_{enc}^{cur}$  
* **Loss Function:** $\\mathcal{L} \= \-\\sum\_{j=1}^{|y|} \\log P\_{\\theta}(y\_{j}|y\_{\<j}, i\_{past}, i\_{cur}, s\_{txt})$.

**Results / Objective Reached:** PLURAL outperformed SOTA methods in both diff-VQA and conventional single-image VQA. It achieved significantly higher NLG metrics, such as a CIDEr score of 1.832 compared to the previous best of 1.027.

**Future Works:** The authors suggest this pipeline will promote diff-VQA applications to assist radiologists. While specific next steps aren't detailed, the error analysis suggests improving the model's ability to avoid time-reverse descriptions in longitudinal changes.

**Title:** Pushing Large Language Models to the 6G Edge: Vision, Challenges, and Opportunities

**Literature Review:**

The rise of Large Language Models (LLMs) like GPT-4 and LLaMA 2, powered by transformer architectures, has revolutionized AI. Traditionally, these models are deployed via cloud computing, which offers immense resources but suffers from high latency and privacy risks. While on-device deployment is an alternative, it is severely restricted by the limited computing, memory, and energy of end devices. Consequently, researchers are turning toward 6G Mobile Edge Computing (MEC) to support distributed AI.

**Gap Analysis:**

Current LLM deployment methods face a dilemma: cloud-based models are non-scalable for real-time multimodal data and raise privacy concerns, while on-device models (often \<10B parameters) have limited performance. Furthermore, most current implementations focus on inference, neglecting the critical need for on-device training to personalize models for individual users.

**Contributions:**

* Proposes a **6G MEC architecture** specifically tailored for LLM deployment.  
* Introduces the concept of **end-edge cooperation**, utilizing split learning and inference to balance workloads.  
* Explores a spectrum of cutting-edge techniques, such as **SplitLoRA**, parameter-sharing, and Small-Large Language Model (SLM-LLM) cooperation.

**Methodologies:**

* **Split Learning/Inference**: Partitioning the model between devices and edge servers to safeguard privacy and distribute computational load.  
* **Parameter-Efficient Fine-Tuning (PEFT)**: Using techniques like LoRA, adapter tuning, and prompt tuning to update less than 1% of parameters, reducing overhead.  
* **Edge Parallelism**: Utilizing pipeline, tensor, and data parallelism across multiple MEC servers.  
* **Speculative Decoding**: Running SLMs on devices for fast token generation, with edge-based LLMs providing parallel verification.

**Equations:**

* **Input Transformation (Time Encoding)**: The paper discusses the use of time encoding for longitudinal data, such as $v\_{trans}^{past} \= P\_{img}(v\_{past}) \+ p\_{enc}^{img} \+ t\_{enc}^{past}$.  
* **Loss Function**: A standard negative log-likelihood loss for training is referenced: $\\mathcal{L} \= \-\\sum\_{j=1}^{|y|} \\log P\_{\\theta}(y\_{j}|y\_{\<j}, i\_{past}, i\_{cur}, s\_{txt})$.

**Results / Objective Reached:**

The paper establishes that end-edge cooperation significantly reduces latency and energy consumption compared to purely on-device or cloud-based models. For instance, **SplitLoRA** enables efficient model adaptation within reasonable timeframes on edge servers while maintaining competitive performance metrics like BLEU.

**Future Works:**

* Developing **green and sustainable** cooperation strategies through adaptive freezing ratios and uncertainty-aware decision mechanisms.  
* Enhancing **privacy-preserving** mechanisms using noise injection techniques like differential privacy and homomorphic encryption.  
* Addressing "catastrophic forgetting" and optimizing expert selection in Mixture of Experts (MoE) architectures.

**Title:** Q2ATransformer: Improving Medical VQA via an Answer Querying Decoder

**Literature Review:**

Visual Question Answering (VQA) in the medical domain assists in clinical decisions by answering questions related to medical images. Most existing methods are "closed-type" classification approaches that treat each answer as a fixed class. While effective for simple "Yes/No" questions, they struggle with varied open-end questions. Conversely, "open-type" generation-based approaches produce answers word-by-word but often generate non-existent answers, resulting in low accuracy.

**Gap Analysis:**

There is a need to bridge the gap between simple classification methods and complex generative models. Current classification-based systems perform poorly on long open-end questions, while generative systems face excessive search spaces that lead to inaccurate, fabricated answers.

**Contributions:**

* Proposed a "semi-open" framework (Q2ATransformer) that combines the reduced search space of classification with the semantic interaction of generative models.  
* Introduced a Cross-modality Attention Network (CMAN) that uses concatenation instead of summation or multiplication to fuse image and question features with minimal information loss.  
* Achieved state-of-the-art results on VQA-RAD and PathVQA benchmarks, particularly on open-end questions.

**Methodologies:**

The Q2ATransformer consists of two main components:

* **Visual-Question Encoder:** Uses a Swin Transformer for images and BERT for questions, fused via CMAN.  
* **Answer-Querying Decoder:** Employs learnable candidate answer embeddings as queries. These embeddings interact with fused features through self-attention and cross-attention to predict answer existence.

**Equations:**

* **Fused Feature ($F\_f$):** $F\_f \= W\_f \[softmax(\\frac{Q\_{F\_c} K\_{F\_c}^T}{\\sqrt{d\_k}}) V\_{F\_c}\] \+ b\_f$, where $F\_c$ is the concatenated features.  
* **Asymmetric Loss:** $L \= \\begin{cases} (1-p\_c)^{\\gamma+} \\log(p\_c) & y\_c=1 \\ (p\_c)^{\\gamma-} \\log(1-p\_c) & y\_c=0 \\end{cases}$ to address class imbalance.

**Results / Objective Reached:**

The model achieved 80.48% overall accuracy on VQA-RAD and 74.61% on PathVQA. Notably, it reached 79.19% accuracy on VQA-RAD open-end questions, a 16.09% absolute improvement over previous best methods.

**Future Works:**

The authors plan to explore sparse attention mechanisms to reduce the computational overhead caused by global self-attention when the number of answer classes is very large.

**Title:** RadAgents: Multimodal Agentic Reasoning for Chest X-ray Interpretation with Radiologist-like Workflows

**Literature Review:**

Chest X-ray (CXR) interpretation is a high-volume diagnostic task that is increasingly being addressed by AI. Prevailing multimodal large language models (MLLMs) often follow an "encode-once, text-only" design where reasoning is decoupled from evolving visual evidence. While some agentic frameworks use external tools to assist in these tasks, they often remain opaque, weakly aligned with clinical workflows, and struggle to resolve inconsistencies between different tools.

**Gap Analysis:**

Existing medical AI systems for CXR interpretation suffer from three primary limitations:

* Reasoning is often not clinically interpretable or aligned with professional guidelines.  
* Multimodal evidence is insufficiently integrated, leading to text rationales that lack visual grounding.  
* There is a lack of principled verification mechanisms to detect and resolve cross-tool inconsistencies.

**Contributions:**

* Formalization of radiologist-like multimodal workflows for CXR interpretation within a multi-agent system.  
* Development of a traceable architecture combining an Orchestrator, five specialized subagents, and a Synthesizer with retrieval-augmented conflict resolution.  
* Extensive benchmarking across three challenging datasets, demonstrating that lightweight open-source models can surpass large proprietary models when using this framework.

**Methodologies:**

RadAgents decomposes CXR interpretation into seven specialized agents. Five subagents implement the clinical **ABCDE** (Airway, Breathing, Circulation, Diaphragm, Everything else) review scheme. An **Orchestrator** analyzes queries to dispatch tasks, while a **Synthesizer** aggregates outputs and resolves tool conflicts using Visual Retrieval-Augmented Generation (V-RAG). The system utilizes a diverse toolset, including ROI segmentation, phrase grounding, and specialized VQA models.

**Equations:**

The paper utilizes geometric measurements for diagnostic indices, such as the Cardiothoracic Ratio (CTR):

$$CTR \= \\frac{cardiac\\ width}{thoracic\\ width}$$

Other ratios are similarly used for mediastinal widening and aortic enlargement by comparing calculated widths or areas against expert-defined thresholds.

**Results / Objective Reached:**

RadAgents consistently outperformed competitive baselines, achieving an overall accuracy of 73.6% on the Chest Agent Bench, compared to 56.4% for GPT-4o. It also achieved the highest overall accuracy (74.6%) on CheXbench. The inclusion of V-RAG provided a significant performance boost, particularly for diagnosis and characterization tasks.

**Future Works:**

The authors identify the need for broader human studies and prospective clinical assessments to understand the real-world impact of the system. Future research may also address the system's sensitivity to errors or distribution shifts in its underlying external tools.

**Title:** Read Like a Radiologist: Efficient Vision-Language Model for 3D Medical Imaging Interpretation.

**Literature Review:**

Recent progress in medical vision-language models (VLMs) has primarily focused on 2D modalities like X-rays. Extending these to 3D imaging, such as CT and MRI, is difficult due to computational complexity, large data volumes, and a shortage of paired image-report datasets. Existing 3D VLMs, like RadFM and M3D-LaMed, often use fixed-size 3D patch embeddings. Unlike natural video data with high redundancy, medical 3D images have fewer slices along the z-axis, making these fixed-size patch methods less effective at capturing fine anatomical details.

**Gap Analysis:**

Current 3D VLMs often partition volumes into sub-volumetric 3D patches, which introduces overly correlated representations along the z-axis. This process neglects slice-specific clinical details, which is problematic for medical images where adjacent slices have low redundancy. Furthermore, fixed 3D vision encoders struggle to handle volumetric data with variable slice lengths common in clinical practice.

**Contributions:**

* Introduced **MS-VLM**, a model that mimics radiologists' workflows by processing 3D volumes as a collection of 2D planes.  
* Developed a novel **Z-former** architecture that handles volumetric data with variable slice lengths.  
* Improved data and computational efficiency by leveraging self-supervised 2D transformer encoders.  
* Demonstrated robust performance in integrating information from multi-view and multi-phase imaging.

**Methodologies:**

MS-VLM uses a four-stage training process: (0) training a domain-specific 2D DINO vision encoder to extract slice-specific features; (1) training the Z-former using **masked embedding modeling (MEM)** to capture inter-slice dependencies; (2) training a bridger module to align visual features with the LLM space; and (3) instruction fine-tuning the LLM (Vicuna-7B) for radiology report generation and VQA.

**Equations:**

The Z-former is optimized via $l\_1$ loss to reconstruct masked embeddings:

$$\\mathcal{L}*{MEM}=\\frac{1}{|M|}||\\hat{Z}*{masked}-Z\_{vol}||*{1}$$.*

*Fine-tuning the LLM involves minimizing the negative log-likelihood (NLL):*

*$$\\mathcal{L}*{inst}=-\\sum\_{t=1}^{T}log P(y\_{t}|y\_{\<t},Q,I)$$.

**Results / Objective Reached:**

MS-VLM outperformed baselines on the CT-RATE and rectal MRI datasets. In chest CT evaluation, it achieved an average F1 score of 0.261, surpassing models like CT2Rep. It demonstrated faster convergence and produced more clinically relevant reports by effectively recalling subtle abnormal findings.

**Future Works:**

The authors identify several areas for future research, including performing larger-scale studies with more diverse datasets and evaluating the model's generalizability to other imaging modalities like abdominal CT. Additionally, direct expert evaluation is needed to guide the model's refinement for practical clinical deployment.

**Title:** RJUA-MedDQA: A Multimodal Benchmark for Medical Document Question Answering and Clinical Reasoning.

**Literature Review:**

Recent advancements in Large Language Models (LLMs) and Large Multi-modal Models (LMMs) have shown potential in medical applications like automated diagnostics. However, existing document-based Visual Question Answering (VQA) datasets, such as DocVQA and VisualMRC, primarily focus on extractive tasks rather than reasoning. While some datasets like ScienceQA and SLAKE incorporate contextual reasoning or medical semantic labels, they often lack the complex layouts and specialized data found in real-world medical reports.

**Gap Analysis:**

Existing benchmarks do not reflect the complexity of real-world medical reports, which often feature challenging layouts, misaligned or blurred text, and integrated tabular data. Furthermore, there is a lack of specialized datasets requiring successive logical connections and numerical reasoning to derive disease diagnoses and clinical advice from multimodal contexts.

**Contributions:**

* Established **RJUA-MedDQA**, the largest real-world Chinese multimodal benchmark for urology-focused medical reports, containing 2,000 images and 72,000 QA pairs.  
* Developed the **Efficient Structural Restoration Annotation (ESRA)** method to reconstruct textual and tabular content, improving annotation accuracy to 96.8%.  
* Introduced a **Knowledge Fact Base** containing logical chains for disease diagnosis and treatment extracted from official guidelines.  
* Integrated a **synonym-aware automatic QA generator** to produce diverse questions ranging from simple facts to complex inferences.

**Methodologies:**

The benchmark defines two primary tasks: **Image Content Recognition VQA** (extracting entities and interpreting tables) and **Clinical Reasoning VQA** (integrating image content with provided medical context). The ESRA method utilizes OCR results to partition text into lines and calculate average character width to restore original document structure using spaces and line breaks. Five LMMs and two LLMs (paired with ESRA-generated text) were evaluated using task-specific metrics like **Soft Accuracy** and **ROUGE-L**.

**Equations:**

* **Line Partitioning Flag:** $flag=bool\[(y\_{i+1,0}+\\epsilon\_{1}\<\\frac{y\_{i,1}-y\_{i,0}}{2}) | (y\_{i,0}+\\epsilon\_{2}\<\\frac{y\_{i+1,1}-y\_{i+1,0}}{2}\<y\_{i,1}-\\epsilon\_{2})\]$.  
* **Average Character Width:** $c^{*}=\\frac{w\_{total}^{*}}{N\_{total}^{\*}}$.  
* **Space Calculation:** $number\_of\_spaces \= max( \\frac{h\_{i,j,k}}{c^{\*}l}, 1)$.  
* **Asymmetric Loss (from related work context):** $L \= \\begin{cases} (1-p\_c)^{\\gamma+} \\log(p\_c) & y\_c=1 \\ (p\_c)^{\\gamma-} \\log(1-p\_c) & y\_c=0 \\end{cases}$.

**Results / Objective Reached:**

* LMMs are more robust to low-quality, diverse-structured images than traditional OCR-based LLM methods.  
* Existing LMMs still struggle with complex clinical reasoning; **GPT-4v** showed the strongest reasoning among LMMs but still trailed **ESRA+GPT-4** by a significant margin (approx. 0.3 accuracy).  
* The benchmark identified significant challenges in **cross-instance understanding** and addressing model **hallucinations**.

**Future Works:**

Future studies will focus on improving **contextual reasoning** and exploring methods to mitigate the three common errors identified: incorrect extraction, hallucinations, and faulty reasoning.

**Title:** Scaling Agentic Reinforcement Learning for Tool-Integrated Reasoning in VLMs

**Literature Review:**

Recent advancements in Vision-Language Models (VLMs) have primarily utilized text-based reasoning paradigms like Chain-of-Thought (CoT) and Reinforcement Learning (RL). However, most existing models still rely on static visual embeddings, which often fail to capture the fine-grained visual structures and spatial relationships required for complex real-world tasks. To address this, "thinking-with-images" paradigms have been introduced, incorporating tool-integrated reasoning (TIR) to equip models with external tools like grounding or zoom-in functions. While some specialized environments exist for robotics or gaming, scalable environments for open-domain visual tool-integrated RL remain largely underexplored.

**Gap Analysis:**

Existing open-source and proprietary VLMs frequently struggle with effectively leveraging tools, often showing degraded accuracy when tools are naively introduced without specific training. Current research into tool usage is often narrow in scope, limited to specific specialized tools or restricted task domains, which hinders broader generalization.

**Contributions:**

* **VISTA-Gym:** A scalable, agentic training environment providing a standardized interface for 26 visual tools and unifying 7 reasoning tasks across 13 datasets.  
* **VISTA-R1:** A VLM-based agent trained using a two-stage process (Imitation Learning followed by Online RL) to robustly interleave reasoning with tool execution.  
* **Performance:** VISTA-R1-8B significantly outperforms state-of-the-art baselines of comparable size by 9.51%–18.72% across 11 benchmarks.

**Methodologies:**

The training framework consists of two stages: **Stage I (Warmup)** uses Behavioral Cloning on expert trajectories synthesized from proprietary and open-weights models. **Stage II (Online RL)** employs Group Relative Policy Optimization (GRPO) to refine the agent through multi-turn rollouts in the executable VISTA-Gym environment. The environment features a Gymnasium-style API and a concurrent microservice architecture to manage compute-intensive VLM tools.

**Equations:**

* **BC Objective:** $\\mathcal{L}*{BC}(\\theta)=\\mathbb{E}*{(x,\\tau)\\sim\\mathcal{D}}\[log \\pi\_{\\theta}(\\tau|x)\]$.  
* **GRPO Loss:** $\\mathcal{L}*{GRPO}(\\theta)=\\frac{1}{G}\\sum*{i=1}^{G}\\frac{1}{|\\tau\_{i}|}\\sum\_{k=1}^{|\\tau\_{i}|}min\[r\_{i,k}(\\theta)\\cdot\\hat{A}*{i,k}, clip(r*{i,k}(\\theta),1-\\epsilon,1+\\epsilon)\\cdot\\hat{A}\_{i,k}\]$.  
* **Final Reward:** $R(U) \= R\_{rep}(U) \+ R\_{format}(U) \+ R\_{correct}(U)$, combining repetition penalty, structural format verification, and outcome correctness.

**Results / Objective Reached:**

VISTA-R1 demonstrated superior parameter efficiency, with the 2B version rivaling 8B baselines and the 8B version performing comparably to 38B models. RL was found to be critical for unlocking tool-use capabilities, as simply adding tools to base models without RL training often decreased performance.

**Future Works:**

The authors suggest that future progress could stem from implementing richer stepwise semantics and expanding the tool ecosystem further to benefit long-horizon tool-integrated reasoning.

\*\*Title:\*\* Self-Adapting Large Visual-Language Models to Edge Devices across Visual Modalities

\*\*Literature Review:\*\*  
Large-scale Vision-Language (VL) models like CLIP use dual encoders to map images and text into a shared feature space, enabling zero-shot and open-vocabulary visual recognition. Recent work has explored open-vocabulary tasks primarily for RGB images. Meanwhile, cross-modality knowledge distillation (KD) has been used to transfer expertise between different data types (e.g., LiDAR to RGB), and model quantization techniques like Post Training Quantization (PTQ) and Quantization Aware Training (QAT) help reduce computational footprints for limited hardware.

\*\*Gap Analysis:\*\*  
Deploying large VL models on edge devices faces three critical hurdles: (i) generalization to non-RGB modalities (e.g., depth, infrared) often results in an 8-fold accuracy decrease; (ii) a lack of labeled data in the wild prevents standard fine-tuning; and (iii) the massive computational requirements of models like CLIP exceed edge device memory and TOPS performance. Existing research often addresses cross-modal transfer and model compression in isolation, neglecting their synergy and the impact of label scarcity.

\*\*Contributions:\*\*  
The authors introduce \*\*EdgeVL\*\*, the first systematic framework to adapt large VL models for edge deployment. It provides:

  \* A method to transfer visual-language alignment to compact models for both RGB and non-RGB images without manual annotations.  
  \* Quantization-aware training enhanced by a novel contrastive learning loss to maintain feature quality post-quantization.  
  \* Significant efficiency gains, showcasing up to a 93-fold reduction in model size and 15.4% accuracy improvements on multiple datasets.

\*\*Methodologies:\*\*  
EdgeVL employs a two-stage framework:

  \* \*\*Stage 1: Dual-Modality Knowledge Distillation.\*\* It uses an automated data selection mechanism guided by a ChatGPT-4 generated "label superset" to curate high-confidence training pairs. A compact student model (e.g., Swin-T) is trained via weight sharing to align its RGB and non-RGB features with the large frozen teacher model.  
  \* \*\*Stage 2: Quantization-aware Contrastive Learning.\*\* To further boost efficiency, the student model is fake-quantized and refined using a triplet contrastive loss to preserve discriminative feature quality at low bitrates.

\*\*Equations:\*\*

  \* \*\*Image Confidence Score ($c\\\_i$):\*\* $c\\\_i \= \\\\max{s\\\_k | s\\\_k \= \\\\frac{\\\\Phi\\\_{img}(x\\\_i)^\\\\top \\\\Phi\\\_{text}(Y\\\_k)}{\\\\sum\\\_{j \\\\in S} \\\\Phi\\\_{img}(x\\\_i)^\\\\top \\\\Phi\\\_{text}(Y\\\_j)}}$.  
  \* \*\*Feature Distillation Loss ($L\\\_d$):\*\* $L\\\_d \= d(\\\\Phi\\\_{img}(x), \\\\Phi\\\_{img}^{stu}(x')) \+ d(\\\\Phi\\\_{img}(x), \\\\Phi\\\_{img}^{stu}(x))$.  
  \* \*\*Contrastive Learning Loss ($\\\\mathcal{L}\\\_c$):\*\* $\\\\mathcal{L}\*c \= \\\\frac{1}{J} \\\\sum\*{j=1}^{J} d(f(x\\\_i), f(p\\\_{i,k^\\\*})) \- d(f(x\\\_i), f(n\\\_{i,j})) \+ m$.

\*\*Results / Objective Reached:\*\*  
EdgeVL achieved superior accuracy over all baselines on ScanNet and EuroSAT datasets, outperforming the next best baseline by up to 13.9%. It achieved a model size as small as 56MB (compared to CLIP-G's 5213MB) and doubled throughput (1492 images/s vs. 772 for CLIP-B) while reducing latency by over 50% on edge hardware like Jetson AGX Orin.

\*\*Future Works:\*\*  
Future research will focus on overcoming the challenge of preserving generalization performance for RGB images when the model is adapted for cross-modal use, as current adaptation can lead to slight decreases in RGB accuracy compared to large pre-trained models.

* **Title**: Interpretable Medical Image Visual Question Answering via Multi-Modal Relationship Graph Learning.  
* **Literature Review**: Previous medical VQA methods often used joint embedding frameworks with CNN backbones. However, these "black-box" models frequently exploit dataset biases rather than understanding deep visual and semantic relationships. Existing datasets, such as VQA-RAD and ImageCLEF VQA-Med, are limited by small sizes and simple questions (e.g., "Is there something wrong?").  
* **Gap Analysis**: There is a lack of large-scale medical VQA datasets that include complex questions regarding detailed relationships like disease levels, locations, and types. Furthermore, existing models fail to explicitly leverage rigorous medical knowledge graphs or consider spatial relations between anatomical structures and diseased regions.  
* **Contributions**:  
  * Construction of **Mimic-VQA**, a large-scale dataset with 297,723 QA pairs based on 134,400 chest X-rays.  
  * Proposal of a novel **multi-relationship graph model** incorporating visual, spatial, and semantic relationships.  
  * Implementation of an **interpretable reasoning path** for VQA answers.  
* **Methodologies**: The framework extracts Regions of Interest (ROIs) using Faster R-CNN. It constructs three graph types: **Spatial** (based on ROI locations), **Semantic** (using anatomical and co-occurrence knowledge), and **Implicit** (for latent relationships). These are updated using a Relation-Aware Graph Attention Network (ReGAT).  
* **Equations**:  
  * Final feature vector: $a\_{final}=(1-\\alpha-\\beta) \\times a\_{imp}+\\alpha \\times a\_{spa}+\\beta \\times a\_{sem}$.  
  * Implicit attention weights: $\\alpha\_{ij}=\\frac{\\alpha\_{ij}^{b} \\cdot exp(\\alpha\_{ij}^{v})}{\\sum\_{j=1}^{K}\\alpha\_{ij}^{b} \\cdot exp(\\alpha\_{ij}^{v})}$.  
* **Results/Objective Reached**: The proposed model outperformed state-of-the-art methods like MMQ, achieving an **AUC-micro of 0.996** and an **AUC-macro of 0.964** on the Mimic-VQA dataset.  
* **Future Works**: While not explicitly labeled as "Future Works," the authors noted current **limitations** to be addressed, such as confusion between similar abnormalities (e.g., atelectasis vs. lung opacity) and inaccuracies stemming from the pre-trained Faster R-CNN backbone.

