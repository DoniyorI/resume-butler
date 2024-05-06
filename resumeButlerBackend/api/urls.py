from django.urls import path
from . import views

urlpatterns = [
    path('data/create-resume', views.handle_request, name='create-resume'),
]
