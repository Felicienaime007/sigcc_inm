"""Notifications déclenchées par les changements d'état des documents."""
from django.apps import apps
from django.db.models.signals import post_save, pre_save

from apps.audit.context import acteur

from . import services as s


# ---------------------------------------------------------------- Gestionnaires
def h_commande(pk, creee, avant, uid):
    from apps.commercial.models import Commande
    c = Commande.objects.select_related('client').filter(pk=pk).first()
    if c is None or c.statut_commande == (avant or {}).get('statut_commande'):
        return
    if c.statut_commande == 'VALIDEE':
        s.notifier('commande.a_preparer', f"Commande à préparer : {c.num_commande}",
                   f"{c.client.nom_client} · {s.ar(sum(l.quantite_commandee * l.prix_unitaire_facture for l in c.lignes.all()))} HT",
                   lien='/commercial/preparations', exclure=uid)
    elif c.statut_commande == 'LIVREE':
        s.notifier('commande.livree', f"Commande livrée, à facturer : {c.num_commande}",
                   c.client.nom_client, lien='/commercial/factures', exclure=uid)


def h_facture(pk, creee, avant, uid):
    from apps.commercial.models import Facture
    f = Facture.objects.select_related('client', 'commande__client').filter(pk=pk).first()
    if f is None or f.commande_id is not None:        # seules les ventes au comptoir sont concernées
        return
    client = f.client_facture
    nom_client = client.nom_client if client is not None else '—'
    if creee:
        s.notifier('vente.a_encaisser', f"Vente à encaisser : {f.num_facture}",
                   f"{nom_client} · {s.ar(f.montant_ht + f.tva)} TTC",
                   lien='/tresorerie/reglements', exclure=uid)
    elif f.statut_paiement == 'PAYEE' and (avant or {}).get('statut_paiement') != 'PAYEE':
        message = f"{nom_client} · {s.ar(f.montant_ht + f.tva)} TTC"
        if not hasattr(f, 'bon_livraison'):
            s.notifier('vente.a_livrer', f"Vente payée, à livrer : {f.num_facture}", message,
                       lien='/commercial/livraisons', exclure=uid)
        s.notifier('vente.payee', f"Vente encaissée : {f.num_facture}", message,
                   lien='/commercial/factures', exclure=uid)


def h_lot(pk, creee, avant, uid):
    from apps.produits.models import LotLancementSerie
    lot = LotLancementSerie.objects.select_related('produit').filter(pk=pk).first()
    if lot is None:
        return
    if creee:
        s.notifier('lot.a_demarrer', f"Lot à démarrer : {lot.num_lot}",
                   f"{lot.quantite_lancee} × {lot.produit.code_produit}", lien='/produits/lots', exclure=uid)
    elif lot.statut_prod == 'TERMINE' and (avant or {}).get('statut_prod') != 'TERMINE' and lot.preparation_id:
        s.notifier('lot.termine', f"Lot terminé : {lot.num_lot}",
                   f"{lot.produit.code_produit} est en stock : la préparation peut être finalisée.",
                   lien='/commercial/preparations', exclure=uid)


def h_engagement(pk, creee, avant, uid):
    from apps.budget.models import EngagementBudget
    e = EngagementBudget.objects.select_related('client', 'ligne_budget').filter(pk=pk).first()
    if e is None or not creee:
        return
    s.notifier('engagement.vise', f"Engagement visé : {e.num_engagement_cf}",
               f"{e.client.nom_client} · {s.ar(e.montant_engage)} · article {e.ligne_budget.code_article}",
               lien='/budget/engagements', exclure=uid)


def h_solvabilite(pk, creee, avant, uid):
    from apps.clients.models import SolvabiliteClient
    f = SolvabiliteClient.objects.select_related('client').filter(pk=pk).first()
    if f is None or not f.statut_blocage or (avant or {}).get('statut_blocage'):
        return
    s.notifier('client.bloque', f"Client bloqué : {f.client.nom_client}",
               "Aucune commande de ce client ne peut être validée.",
               lien=f'/clients/{f.client_id}', exclure=uid)


def h_recouvrement(pk, creee, avant, uid):
    from apps.recouvrement.models import Recouvrement
    d = Recouvrement.objects.filter(pk=pk).first()
    if d is None or d.statut_dossier != 'CONTENTIEUX' or (avant or {}).get('statut_dossier') == 'CONTENTIEUX':
        return
    ligne = d.lignes.select_related('facture__commande__client', 'facture__client').first()
    facture = ligne.facture if ligne is not None else None
    client = facture.client_facture if facture is not None else None
    nom_client = client.nom_client if client is not None else '—'
    total = sum(l.montant_a_recouvrer for l in d.lignes.all())
    s.notifier('recouvrement.contentieux', f"Contentieux : {d.num_dossier}",
               f"{nom_client} · {s.ar(total)} à recouvrer", lien=f'/recouvrement/{d.pk}', exclure=uid)


def h_quittance(pk, creee, avant, uid):
    from apps.tresorerie.models import NB_VOLETS_CARNET, LivreQuittance
    if not creee:
        return
    from apps.tresorerie.models import Quittance
    q = Quittance.objects.filter(pk=pk).first()
    if q is None:
        return
    livre = LivreQuittance.objects.get(pk=q.livre_id)
    restant = NB_VOLETS_CARNET - livre.quittances.count()
    palier = 3 if restant <= 3 else 10 if restant <= 10 else 25 if restant <= 25 else None
    if palier is None:
        return
    s.notifier('carnet.bientot_epuise', f"Carnet {livre.numero_livre} bientôt épuisé",
               f"Il reste {restant} volet(s) sur {NB_VOLETS_CARNET}. Prévoyez un nouveau carnet.",
               lien='/tresorerie/quittances', niveau='URGENT' if palier == 3 else None,
               cle=f'carnet:{livre.pk}:{palier}', fenetre=s.jours(3650))


# --------------------------------------------------- Modèles surveillés
# modèle -> (champs dont on mémorise l'ancienne valeur, gestionnaire)
SURVEILLES = {
    'commercial.Commande': (('statut_commande',), h_commande),
    'commercial.Facture': (('statut_paiement',), h_facture),
    'produits.LotLancementSerie': (('statut_prod',), h_lot),
    'budget.EngagementBudget': ((), h_engagement),
    'clients.SolvabiliteClient': (('statut_blocage',), h_solvabilite),
    'recouvrement.Recouvrement': (('statut_dossier',), h_recouvrement),
    'tresorerie.Quittance': ((), h_quittance),
}


def _label(sender):
    return f'{sender._meta.app_label}.{sender._meta.object_name}'


def _pre_save(sender, instance, raw=False, **kwargs):
    if raw:
        return
    champs = SURVEILLES[_label(sender)][0]
    instance._notif_avant = None
    if champs and instance.pk is not None and not instance._state.adding:
        instance._notif_avant = sender._base_manager.filter(pk=instance.pk).values(*champs).first()


def _post_save(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    handler = SURVEILLES[_label(sender)][1]
    s.plus_tard(handler, instance.pk, created, getattr(instance, '_notif_avant', None), acteur()[0])


def connecter():
    for label in SURVEILLES:
        modele = apps.get_model(label)
        uid = f'notif_{label}'
        pre_save.connect(_pre_save, sender=modele, dispatch_uid=f'{uid}_pre', weak=False)
        post_save.connect(_post_save, sender=modele, dispatch_uid=f'{uid}_post', weak=False)