"""
Modèles audités : 'app_label.NomModele': attribut utilisé comme référence lisible (ou None).
Pour auditer une table de plus, ajoutez simplement une ligne ici.
"""
AUDITED = {
    # Exigés par le cahier des charges
    'commercial.Commande': 'num_commande',
    'commercial.Facture': 'num_facture',
    'tresorerie.Reglement': None,
    'produits.LotLancementSerie': 'num_lot',
    # Ajouts : tables financières et de contrôle
    'budget.EngagementBudget': 'num_engagement_cf',
    'tresorerie.Quittance': None,
    'tresorerie.Caisse': 'code_caisse',
    'recouvrement.Recouvrement': 'num_dossier',
    'clients.SolvabiliteClient': None,
}

# Champs jamais copiés dans l'audit
CHAMPS_EXCLUS = {'password', 'mot_de_passe'}