import PyPDF2


def open_pdf(file_path):
    with open(file_path, 'rb') as file:
        pdf = PyPDF2.PdfFileReader(file)
        return pdf
    
def extract_text(pdf):
    pass