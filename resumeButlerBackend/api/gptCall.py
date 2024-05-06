from openai import OpenAI
import json
from django.conf import settings

def gptCalls(prompt, jobDescription, cv):
    config = settings.OPEN_API_KEY
    client = OpenAI(api_key=config)

    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "Provide output in valid JSON"},
            {"role": "user", "content": prompt + "\n" + jobDescription + "\n" + cv}
        ],
        model="gpt-3.5-turbo-1106",
        response_format= {"type": "json_object"},
    )

    response_dict = chat_completion if isinstance(chat_completion, dict) else chat_completion.__dict__

    # print(response_dict)
    contet = response_dict["choices"][0]
    choice = contet.__dict__
    message = choice["message"]
    content = message.__dict__
    newCv = json.loads(content["content"])
    
    return newCv


# header = ["EXPERIENCE:", "PROJECTS:", "experience:", "projects:"]
# def parse_experience_projects(input_text):
#     # Split the input into lines for processing
#     lines = input_text.split('\n')

#     # Initialize variables to hold the current state while parsing
#     structured_dict = {}
#     current_section = None
#     current_title = None

#     for line in lines:
#         # Remove leading and trailing whitespace
#         line = line.strip()

#         # Skip empty lines
#         if not line:
#             continue

#         # Check if the line is a section header (all uppercase)
#         if line in header:
#             current_section = line
#             structured_dict[current_section] = {}
#             current_title = None  # Reset current title for new section
#         elif not line.startswith("-"):
#             # This is a title within a section
#             current_title = line
#             structured_dict[current_section][current_title] = []
#         elif line.startswith('-'):
#             # This is a bullet point under the current title
#             structured_dict[current_section][current_title].append(line[2:])
#     return structured_dict
# shh = parse_experience_projects(bullets)
# print(shh)