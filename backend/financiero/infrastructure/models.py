from django.db import models


class AuditConciliacion(models.Model):
    usuario_id        = models.IntegerField()
    usuario_nombre    = models.CharField(max_length=255)
    usuario_tipo      = models.SmallIntegerField()
    area_id           = models.IntegerField(null=True, blank=True)
    area_nombre       = models.CharField(max_length=255, blank=True)
    banco             = models.CharField(max_length=50)
    total_banco       = models.IntegerField()
    total_sap         = models.IntegerField()
    tasa_conciliacion = models.FloatField()
    fecha_ejecucion   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering  = ['-fecha_ejecucion']
        db_table  = 'audit_conciliacion'
        app_label = 'financiero'
