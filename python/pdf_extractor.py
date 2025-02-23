import PyPDF2

PDF_FILE_PATH = "../pdf/sample.pdf"

def extract_text(file_path):
    with open(file_path, 'rb') as file:
        pdf = PyPDF2.PdfReader(file)  # Open PDF file
        text = ""
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:  # Avoid adding "None" if extraction fails
                text += extracted + "\n"
    return text  # Return extracted text

# Example Usage
text = extract_text(PDF_FILE_PATH)
print(text)