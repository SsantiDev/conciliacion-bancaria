from rest_framework import serializers

BANCOS = ['DAVIVIENDA', 'BANCOLOMBIA', 'BOGOTA']


class ConciliacionRequestSerializer(serializers.Serializer):
    banco    = serializers.ChoiceField(choices=BANCOS)
    extracto = serializers.FileField()
    sap      = serializers.FileField()

    def validate_extracto(self, f):
        return _validar_extension(f, 'extracto')

    def validate_sap(self, f):
        return _validar_extension(f, 'sap')


def _validar_extension(f, campo: str):
    ext = f.name.rsplit('.', 1)[-1].lower()
    if ext not in ('xlsx', 'xls', 'csv'):
        raise serializers.ValidationError(
            f"{campo}: solo se permiten .xlsx, .xls, .csv"
        )
    return f
