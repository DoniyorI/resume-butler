import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime
from django.conf import settings

from .gptCall import gptCalls
import json
import re
import json
import datetime

class FirestoreEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        elif isinstance(obj, bytes):
            return obj.decode('utf-8')
        return json.JSONEncoder.default(self, obj)

def is_iso_format(dt_str):
    """Check if the string matches the ISO datetime format."""
    try:
        datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S.%f%z")
        return True
    except ValueError:
        try:
            datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S%z")
            return True
        except ValueError:
            return False

def format_date(dt_str):
    """Convert ISO datetime string to a human-readable format."""
    return datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S.%f%z").strftime("%B %d, %Y") if '.' in dt_str else \
           datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S%z").strftime("%B %d, %Y")

def recursive_format_dates(obj):
    """Recursively search and format date strings in a dictionary."""
    if isinstance(obj, dict):
        return {k: recursive_format_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [recursive_format_dates(item) for item in obj]
    elif isinstance(obj, str) and is_iso_format(obj):
        return format_date(obj)
    else:
        return obj
# Path to your service account key file
# service_account_path = ''
# with open("../resume-butlerFBConfig.json", 'r') as json_file:
#     service_account_path = json.load(json_file)

prompt = """
Resume Aligner is a CV parser designed to analyze job descriptions and parse input dictionaries containing categories such as education, experience, projects, and skills. Its main function is to select and align entries from the input that best match the specified job requirements for a resume. It should NEVER use the same entry more than once. It strictly preserves the content and structure of the input dictionary, neither adding new items nor altering the existing text.

The output JSON object reflects the structure of the input dictionary, accurately categorizing entries under 'experience', 'projects', and 'skills' as they appear in the input, omitting entries unrelated to the job description so that each "experience" and "projects" category will ALWAYS have THREE entries. 

The tool is optimized for API calls, ensuring high responsiveness and adaptability. It delivers responses containing only the output dictionary in a JSON format, structured as described. The output never contains additional commentary or new items and strictly maintains the structure and content of the input. The Response NEEDS to be a JSON object, NO COMMENTARY
"""

prompt2 = """
The GPT takes a list of dictionaries containing skills and categorizes these skills into categories. It outputs the results in a JSON dictionary, mapping each category to a list of skill entries. The category should NOT be "skills"
"""

# jobDescription = """            
# Our Winning Family Starts With You! Check out these great benefits
# • Flexible schedules to help you balance other life commitments (school, childcare, family care, etc.)
# • Free Employee Meal! (limited menu)
# • Weekly pay
# • Anniversary pay
# • Paid Sick Leave (1 hour for every 30 hours worked, begin accruing upon hire)
# • Paid Family and Medical Leave (up to 2 weeks after 1 year of service)
# • Medical/dental insurance
# • Ongoing training to build critical skills for current and future roles
# • Discounts on cellphones, travel, electronics & much more!
# • 401(k) savings plan (Company match after 1 year of service)
# • Management career advancement opportunities (50%+ of our managers are promoted from hourly positions!)

# And much more! Because at Olive Garden, We’re All Family Here!

# One key to our success is the high standards we set for ourselves and each other. That includes placing the health and safety of our team members and guests as a top priority. We are committed to the highest safety and sanitation practices, including ensuring team member wellness and maintaining clean restaurants.

# Dishwashers at Olive Garden play an essential role in delighting and serving our guests while keeping our restaurants clean and safe. As a dishwasher, you will be responsible for the critical tasks of cleaning and sanitizing plates, glassware, utensils, and guest and team member touch points in order to deliver a great guest experience"""
# Initialize the SDK
config = settings.FIREBASE_CONFIG
cred = credentials.Certificate(config)
firebase_admin.initialize_app(cred)

# Initialize Firestore
db = firestore.client()

# Example of fetching documents from a specific collection
def create_resume(userID, title, jobDescription):
    doc_ref = db.collection('users').document(userID)
    # Get the document to confirm it exists (optional but useful for validation)
    doc = doc_ref.get()

    email = doc.get("email")
    github = doc.get("github")
    linkedin = doc.get("linkedin")
    firstName = doc.get("firstName")
    lastName = doc.get("lastName")
    # Fetch all subcollections of the document
    omittedFields = ["applications", "coverletters", "resumes"]
    mydic = {"education": [], "experience": [], "projects": [], "skills": []}
    subcollections = doc_ref.collections()

    for subcollection in subcollections:
        if subcollection.id not in omittedFields:
            for doc in subcollection.stream():
                mydic[subcollection.id].append(doc.to_dict())

    newcv = gptCalls(prompt, jobDescription, json.dumps(mydic, cls=FirestoreEncoder))
    skills = []
    for i in newcv["skills"]:
        skills.append(i["name"])

    skillsList = gptCalls(prompt, "", json.dumps(skills))
    newcv = recursive_format_dates(newcv)

    newcv["email"] = email
    newcv["github"] = github
    newcv["linkedin"] = linkedin
    newcv["name"] = firstName + lastName
    newcv["dateCreated"] = datetime.datetime.now()
    newcv["lastUpdated"] = datetime.datetime.now()
    newcv["title"] = title
    newcv["skills"] = skillsList

    resume = doc_ref.collection('resumes').document()
    resume.set(newcv)