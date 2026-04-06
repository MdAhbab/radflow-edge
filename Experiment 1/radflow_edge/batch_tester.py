import os
import glob
import time
import json
import csv
import argparse
from pathlib import Path

# Adjust import based on being in the same directory as core
from core.pipeline import RadFlowPipeline

def get_image_files(directory):
    """Recursively find all image files in a 45GB data directory."""
    extensions = ['*.png', '*.jpg', '*.jpeg', '*.dcm', '*.PNG', '*.JPG']
    files = []
    for ext in extensions:
        files.extend(Path(directory).rglob(ext))
    return [str(f) for f in files]

def main():
    parser = argparse.ArgumentParser(description="Batch test RadFlow-Edge pipeline on NIH Lung PNGs.")
    parser.add_argument('--data_dir', type=str, required=True, help="Path to your 45GB folder with PNGs")
    parser.add_argument('--output_csv', type=str, default='batch_results.csv', help="Output CSV log file")
    parser.add_argument('--limit', type=int, default=None, help="Max images to process (useful for testing)")
    
    args = parser.parse_args()
    
    print(f"Scanning directory: {args.data_dir}...")
    image_paths = get_image_files(args.data_dir)
    print(f"Found {len(image_paths)} images.")
    
    if len(image_paths) == 0:
        print("No images found. Exiting.")
        return

    if args.limit:
        image_paths = image_paths[:args.limit]
        print(f"Limiting execution to {args.limit} images for this run.")

    print("Initializing RadFlowPipeline. Loading models into memory...")
    pipeline = RadFlowPipeline()
    print("Pipeline ready. Starting batch processing...\n")
    
    # Setup CSV Writer
    file_exists = os.path.isfile(args.output_csv)
    with open(args.output_csv, mode='a', newline='', encoding='utf-8') as csv_file:
        fieldnames = ['file_name', 'status', 'disease', 'confidence', 'report', 'processing_time_sec']
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()

        for idx, img_path in enumerate(image_paths):
            print(f"[{idx+1}/{len(image_paths)}] Processing: {os.path.basename(img_path)}...")
            
            start_time = time.time()
            try:
                # We optionally pass a generic context, or empty if doing pure batch detection
                results = pipeline.process_xray(img_path, patient_context="Batch processing ingestion")
                
                # Parse results for CSV
                end_time = time.time()
                elapsed = round(end_time - start_time, 2)
                
                base_dict = {
                    'file_name': os.path.basename(img_path),
                    'status': results.get('status', 'unknown'),
                    'processing_time_sec': elapsed
                }
                
                if results.get('status') == 'success' and 'results' in results:
                    # Write a row for each finding in this image
                    for finding in results['results']:
                        row = base_dict.copy()
                        row['disease'] = finding['disease']
                        row['confidence'] = finding['confidence']
                        row['report'] = finding['report'].replace("\n", " ") # Keep on one line for CSV
                        writer.writerow(row)
                else:
                    # Normal or no findings
                    row = base_dict.copy()
                    row['disease'] = 'None'
                    row['confidence'] = ''
                    row['report'] = results.get('message', 'No significant pathology.')
                    writer.writerow(row)
                    
            except Exception as e:
                print(f"  ❌ Error processing {img_path}: {e}")
                row = {
                    'file_name': os.path.basename(img_path),
                    'status': 'error',
                    'disease': '',
                    'confidence': '',
                    'report': str(e),
                    'processing_time_sec': round(time.time() - start_time, 2)
                }
                writer.writerow(row)
                
            csv_file.flush() # Ensure it writes cleanly during iteration
            print(f"  ✅ Done in {round(time.time() - start_time, 2)}s")

    print(f"\nBatch processing complete. Results appended to '{args.output_csv}'.")

if __name__ == "__main__":
    main()
