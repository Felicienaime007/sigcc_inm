"""Montants en lettres, en français (ex. 1 340 000 -> « un million trois cent quarante mille »)."""
from decimal import Decimal

UNITES = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
]
DIZAINES = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def _moins_de_100(n, pluriel):
    if n < 17:
        return UNITES[n]
    if n < 20:
        return "dix-" + UNITES[n - 10]
    if n < 70:
        d, u = divmod(n, 10)
        base = DIZAINES[d]
        if u == 0:
            return base
        if u == 1:
            return base + " et un"
        return base + "-" + UNITES[u]
    if n < 80:
        if n == 71:
            return "soixante et onze"
        return "soixante-" + _moins_de_100(n - 60, pluriel)
    if n == 80:
        return "quatre-vingts" if pluriel else "quatre-vingt"
    return "quatre-vingt-" + _moins_de_100(n - 80, pluriel)


def _moins_de_1000(n, pluriel):
    """`pluriel` : le groupe est en fin de nombre ou suivi de « million(s) » ; devant « mille », pas de s."""
    c, r = divmod(n, 100)
    parts = []
    if c == 1:
        parts.append("cent")
    elif c > 1:
        parts.append(UNITES[c] + " cent" + ("s" if r == 0 and pluriel else ""))
    if r:
        parts.append(_moins_de_100(r, pluriel))
    return " ".join(parts)


def en_lettres(n: int) -> str:
    if n == 0:
        return "zéro"
    if n < 0:
        return "moins " + en_lettres(-n)
    milliards, reste = divmod(n, 10 ** 9)
    millions, reste = divmod(reste, 10 ** 6)
    milliers, unites = divmod(reste, 1000)
    parts = []
    if milliards:
        parts.append(_moins_de_1000(milliards, True) + " milliard" + ("s" if milliards > 1 else ""))
    if millions:
        parts.append(_moins_de_1000(millions, True) + " million" + ("s" if millions > 1 else ""))
    if milliers:
        parts.append("mille" if milliers == 1 else _moins_de_1000(milliers, False) + " mille")
    if unites:
        parts.append(_moins_de_1000(unites, True))
    return " ".join(parts)


def montant_en_lettres(valeur) -> str:
    """« Un million trois cent quarante mille ariary » (centimes éventuels en fin de phrase)."""
    v = abs(Decimal(valeur)).quantize(Decimal('0.01'))
    entier = int(v)
    centimes = int((v - entier) * 100)
    texte = en_lettres(entier) + " ariary"
    if centimes:
        texte += f" et {en_lettres(centimes)} centime" + ("s" if centimes > 1 else "")
    return texte[0].upper() + texte[1:]