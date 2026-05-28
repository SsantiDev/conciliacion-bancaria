from django.urls import path
from financiero.interfaces.views import EjecutarConciliacionView

urlpatterns = [
    path('conciliacion/ejecutar/', EjecutarConciliacionView.as_view(), name='conciliacion-ejecutar'),
]
