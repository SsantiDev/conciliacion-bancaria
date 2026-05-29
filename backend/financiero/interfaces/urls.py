from django.urls import path
from financiero.interfaces.views import EjecutarConciliacionView, AuditoriaListView

urlpatterns = [
    path('conciliacion/ejecutar/',  EjecutarConciliacionView.as_view(), name='conciliacion-ejecutar'),
    path('conciliacion/auditoria/', AuditoriaListView.as_view(),        name='conciliacion-auditoria'),
]
