import os
from groq import Groq

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

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
            "content": "Sentence: Als sie die Überraschungsparty sah, war sie völlig aus dem Häuschen!",
        },
        {
            "role": "user",
            "content": "Word to translate: Häuschen",
        }
    ],
    model="llama-3.3-70b-versatile",
    temperature=0,  # Ensures stable and accurate responses
)

print(chat_completion.choices[0].message.content)
