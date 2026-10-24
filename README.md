# Le Prix du refus

Site statique de suivi des coûts publics et conséquences humaines des mobilisations. Les faits sourcés et les hypothèses sont distingués dans les données et l’interface.

## Cloudflare Pages

Connecter ce dépôt avec :
- Branche : `main`
- Framework : aucun
- Commande de build : `exit 0`
- Dossier de sortie : `dist`

Puis associer `leprixdurefus.fr` dans **Custom domains** du projet Pages.

## Développement

Les fichiers publiés sont dans `dist/`. Aucun build ni dépendance npm requis. Prévisualisation : `python3 -m http.server 8080 --directory dist`.

## Données et actualisations

`dist/data.json` contient les sources, paramètres et bilans ; `dist/data.js` expose les mêmes données au navigateur. Garder les deux fichiers synchronisés et actualiser les dates, textes et compteurs de `index.html` concernés. Ne pas extrapoler les bilans humains ni augmenter les coûts sans nouvelle information.

L’automatisation ChatGPT existante publie actuellement vers le Site d’origine. Le transfert dans ce dépôt ne la raccorde pas automatiquement à GitHub : ce raccordement reste à configurer. Cloudflare déploiera les changements envoyés sur `main` une fois le dépôt connecté.

## Application de quiz Nouvel Ordre

Le monorepo contient désormais l’application Next.js dans `apps/web` et l’API Cloudflare dans `apps/api`. Le site historique demeure dans `dist/`. Voir [QUIZZ.md](./QUIZZ.md) pour le développement, les tests, les contenus et les paramètres de production.
