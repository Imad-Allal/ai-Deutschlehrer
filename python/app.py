from flask import Flask, request, jsonify
from flask_cors import CORS  # Add this import
import os
from groq import Groq
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@app.route('/translate', methods=['POST', 'OPTIONS'])  # Add OPTIONS method
def translate():
    # Handle preflight requests
    if request.method == 'OPTIONS':
        return '', 200

    data = request.json
    word = data.get("word", "")
    sentence = data.get("sentence", "")
    
    print(f"Translating '{word}' in the context of '{sentence}'")
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a Deutsch translation assistant. "
                    "Then, translate the given word into English and provide its meaning based on the context. "
                    "If the word is an essential part of an idiomatic expression, provide the idiom explanation instead of a standalone meaning. "
                    "**Do NOT include the idiom if the word is just a common verb, article, or pronoun that doesn't define the idiom itself.** "
                    "If the word is NOT idiomatic, simply provide its translation with a brief meaning. "
                    "Always respond in the following format: \n\n"
                    "[Word] = [Best translation] \n\n"
                    "If the word is a verb, provide the infinitive form in Deutsch in addition to the translation. \n\n"
                    "If the word is NOT part of an idiom:\n"
                    "(In this context) [Brief meaning]\n\n"
                    "If the word IS an essential part of an idiomatic expression:\n"
                    "(In this context) It's part of the idiomatic expression '[Full phrase]', which means '[Idiom meaning]'.\n\n"
                ),
            },
            {
                "role": "user",
                "content": f"Sentence: {sentence}",
            },
            {
                "role": "user",
                "content": f"Word to translate: {word}",
            }
        ],
        model="llama-3.3-70b-versatile",
        temperature=0,  # Ensures stable and accurate responses
    )
    translation = chat_completion.choices[0].message.content
    print(f"Translation: {translation}")
    return jsonify({"translation": translation})

if __name__ == "__main__":
    app.run(port=5000, debug=True)