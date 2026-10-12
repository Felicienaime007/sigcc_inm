"""Photo de profil en base : action dédiée, droits, exposition dans /me et les listes."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import Utilisateur

DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="


def _admin():
    return Utilisateur.objects.create_superuser(
        identifiant="admin-photo", password="x",
        matricule="M-PHOTO-A", nom_complet="Admin Photo",
    )


def _simple():
    return Utilisateur.objects.create_user(
        identifiant="simple-photo", password="x",
        matricule="M-PHOTO-S", nom_complet="Simple Photo",
    )


class PhotoProfilTests(TestCase):
    def setUp(self):
        self.admin = _admin()
        self.simple = _simple()
        self.api_admin = APIClient()
        self.api_admin.force_authenticate(user=self.admin)
        self.api_simple = APIClient()
        self.api_simple.force_authenticate(user=self.simple)

    def _url(self, user):
        return f"/api/users/utilisateurs/{user.pk}/photo/"

    def test_propre_photo_ok(self):
        rep = self.api_simple.post(self._url(self.simple), {"photo": DATA_URL})
        assert rep.status_code == 200, rep.content
        self.simple.refresh_from_db()
        assert self.simple.photo == DATA_URL
        assert rep.data["photo"] == DATA_URL

    def test_retrait_photo(self):
        self.simple.photo = DATA_URL
        self.simple.save(update_fields=["photo"])
        rep = self.api_simple.post(self._url(self.simple), {"photo": None}, format="json")
        assert rep.status_code == 200, rep.content
        self.simple.refresh_from_db()
        assert self.simple.photo is None

    def test_format_refuse(self):
        rep = self.api_simple.post(self._url(self.simple), {"photo": "pas-une-image"})
        assert rep.status_code == 400, rep.content
        self.simple.refresh_from_db()
        assert self.simple.photo is None

    def test_trop_lourd_refuse(self):
        rep = self.api_simple.post(
            self._url(self.simple), {"photo": "data:image/jpeg;base64," + "A" * 1_500_000})
        assert rep.status_code == 400, rep.content

    def test_autrui_sans_privilege_refuse(self):
        rep = self.api_simple.post(self._url(self.admin), {"photo": DATA_URL})
        assert rep.status_code == 403, rep.content
        self.admin.refresh_from_db()
        assert self.admin.photo is None

    def test_admin_modifie_autrui(self):
        rep = self.api_admin.post(self._url(self.simple), {"photo": DATA_URL})
        assert rep.status_code == 200, rep.content
        self.simple.refresh_from_db()
        assert self.simple.photo == DATA_URL

    def test_photo_dans_me(self):
        self.simple.photo = DATA_URL
        self.simple.save(update_fields=["photo"])
        rep = self.api_simple.get("/api/auth/me/")
        assert rep.status_code == 200, rep.content
        assert rep.data["photo"] == DATA_URL

    def test_photo_dans_liste(self):
        self.simple.photo = DATA_URL
        self.simple.save(update_fields=["photo"])
        rep = self.api_admin.get("/api/users/utilisateurs/")
        assert rep.status_code == 200, rep.content
        ligne = next(u for u in rep.data["results"] if u["id_utilisateur"] == self.simple.pk)
        assert ligne["photo"] == DATA_URL

    def test_photo_non_modifiable_par_patch(self):
        # La photo ne passe que par l'action dédiée, pas par PATCH.
        rep = self.api_admin.patch(
            f"/api/users/utilisateurs/{self.simple.pk}/", {"photo": DATA_URL})
        assert rep.status_code == 200, rep.content
        self.simple.refresh_from_db()
        assert self.simple.photo is None
