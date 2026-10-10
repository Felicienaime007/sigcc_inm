"""Rattrapage : fiche de solvabilité par défaut pour les PRIVE existants sans fiche.

À partir de cette version, le signal post_save crée la fiche dès la création
du client ; cette migration couvre les clients créés avant.
"""
from decimal import Decimal

from django.db import migrations


def creer_fiches_manqantes(apps, schema_editor):
    Client = apps.get_model('clients', 'Client')
    SolvabiliteClient = apps.get_model('clients', 'SolvabiliteClient')
    sans_fiche = Client.objects.filter(
        type_client='PRIVE', solvabilite__isnull=True,
    )
    SolvabiliteClient.objects.bulk_create([
        SolvabiliteClient(
            client_id=c.pk, score_credit=Decimal('0'),
            plafond_encours=Decimal('0'), statut_blocage=0,
        )
        for c in sans_fiche.only('pk')
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0003_client_ville_alter_client_fokontany'),
    ]

    operations = [
        migrations.RunPython(creer_fiches_manqantes, migrations.RunPython.noop),
    ]
