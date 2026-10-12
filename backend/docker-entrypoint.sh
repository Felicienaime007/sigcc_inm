#!/bin/sh
# Point d'entrée du conteneur backend : migrations puis serveur.
set -e
python manage.py migrate --noinput
exec "$@"
