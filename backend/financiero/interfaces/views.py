import traceback

from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from financiero.application.use_cases import ejecutar_conciliacion
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
            resultado = ejecutar_conciliacion(
                banco=ser.validated_data['banco'],
                extracto_file=ser.validated_data['extracto'],
                sap_file=ser.validated_data['sap'],
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
