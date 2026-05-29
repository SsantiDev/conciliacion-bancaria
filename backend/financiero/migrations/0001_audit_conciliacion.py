from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='AuditConciliacion',
            fields=[
                ('id',                models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('usuario_id',        models.IntegerField()),
                ('usuario_nombre',    models.CharField(max_length=255)),
                ('usuario_tipo',      models.SmallIntegerField()),
                ('area_id',           models.IntegerField(blank=True, null=True)),
                ('area_nombre',       models.CharField(blank=True, max_length=255)),
                ('banco',             models.CharField(max_length=50)),
                ('total_banco',       models.IntegerField()),
                ('total_sap',         models.IntegerField()),
                ('tasa_conciliacion', models.FloatField()),
                ('fecha_ejecucion',   models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'audit_conciliacion',
                'ordering': ['-fecha_ejecucion'],
            },
        ),
    ]
