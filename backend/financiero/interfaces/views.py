import traceback

from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from financiero.application.use_cases import ejecutar_conciliacion
from financiero.infrastructure.models import AuditConciliacion
from financiero.interfaces.serializers import ConciliacionRequestSerializer


class EjecutarConciliacionView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        import openpyxl
        print(f"[VIEW] openpyxl={openpyxl.__version__}")

        ser = ConciliacionRequestSerializer(data=request.data)
        if not ser.is_valid():
            print(f"[400 SER] {ser.errors}")
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_area = request.data.get('area_id', '')
            audit_context = {
                'usuario_id':     int(request.data.get('usuario_id', 0) or 0),
                'usuario_nombre': request.data.get('usuario_nombre', ''),
                'usuario_tipo':   int(request.data.get('usuario_tipo', 3) or 3),
                'area_id':        int(raw_area) if raw_area else None,
                'area_nombre':    request.data.get('area_nombre', ''),
            }
            resultado = ejecutar_conciliacion(
                banco=ser.validated_data['banco'],
                extracto_file=ser.validated_data['extracto'],
                sap_file=ser.validated_data['sap'],
                audit_context=audit_context,
            )
        except ValueError as exc:
            tb = traceback.format_exc()
            print(f"[400] {exc}\n{tb}")
            return Response({'error': str(exc), 'traceback': tb}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            tb = traceback.format_exc()
            print(f"[500] {exc}\n{tb}")
            return Response(
                {'error': str(exc), 'traceback': tb},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(resultado, status=status.HTTP_200_OK)


class AuditoriaListView(APIView):
    def get(self, request):
        qs = AuditConciliacion.objects.all()[:200]
        data = [
            {
                'id':                 r.id,
                'usuario_id':         r.usuario_id,
                'usuario_nombre':     r.usuario_nombre,
                'usuario_tipo':       r.usuario_tipo,
                'area_id':            r.area_id,
                'area_nombre':        r.area_nombre,
                'banco':              r.banco,
                'total_banco':        r.total_banco,
                'total_sap':          r.total_sap,
                'tasa_conciliacion':  r.tasa_conciliacion,
                'fecha_ejecucion':    r.fecha_ejecucion.isoformat(),
            }
            for r in qs
        ]
        return Response(data, status=status.HTTP_200_OK)
