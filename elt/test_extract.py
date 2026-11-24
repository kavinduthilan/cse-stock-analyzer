
import pdfplumber
import pathlib

pdf_dir = pathlib.Path(__file__).resolve().parents[1] / "data" / "pdfs"

pdf_files = list(pdf_dir.glob("*.pdf"))

print("Total PDF files:", len(pdf_files))

if not pdf_files:
    print("No PDF files found!")
    exit()

pdf_path = pdf_files[0]

print("\nTesting PDF:", pdf_path.name)

with pdfplumber.open(pdf_path) as pdf:

    print("Total pages:", len(pdf.pages))

    for page_number, page in enumerate(pdf.pages[:3], start=1):

        print(f"\n--- PAGE {page_number} ---")

        text = page.extract_text()

        if text:
            print(text[:3000])
        else:
            print("No text found on this page")
