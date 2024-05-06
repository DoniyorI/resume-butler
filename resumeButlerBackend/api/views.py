from django.shortcuts import render
from django.http import JsonResponse, HttpRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .firebaseConfig import create_resume

@csrf_exempt
@require_http_methods(["POST"])
def handle_request(request: HttpRequest):
    try:
        data = json.loads(request.body)
        create_resume(data["userID"], data["title"], data["jobDescription"])
        return JsonResponse({"status": "success", "data": data}, status=200)
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)