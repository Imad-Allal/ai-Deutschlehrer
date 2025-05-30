# AI Deutschlehrer

## Getting Started

### Generate Grok API key
This step is needed to run the Deutsch AI Assistant.
Go to [GrokCloud](https://console.groq.com/keys) and create an account. Then, generate an API key.

### Export the API key

```bash
export GROK_API_KEY=your-api-key
```

> Replace `your-api-key` with the API key you generated.

## Run your Deutsch AI Assistant

```bash
cd python 
python3 deutsch_ai_assistant.py
```

### Words translation

```python
{
    "role": "user",
    "content": "Sentence: [Put your Deutsch sentence here]",
},
{
    "role": "user",
    "content": "Word to translate: [Put your Deutsch word here]",
}
```

## Run PDF extractor

```bash
cd python
python3 pdf_extractor.py
```

### PDF file

Add your PDF file in the `pdf` folder and then update the path here.

```python
PDF_FILE_PATH = "../pdf/your_file.pdf
```
