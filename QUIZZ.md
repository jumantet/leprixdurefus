# Nouvel Ordre — application de quiz

## État livré

- Application Next.js responsive, gratuite, sans points, badges ou classement.
- API Hono / Cloudflare Workers, D1, Drizzle, Better Auth / Google.
- 24 catégories, 120 parcours éditoriaux, 396 questions de plan dans `content/catalog.json`.
- **13 parcours publiés (75 QCM)** : quatre parcours approfondis de 12 questions et neuf parcours initiaux de 3 questions encore à retravailler. 107 parcours en brouillon. Les deux parcours électoraux q096/q099 sont retirés de la sélection courante ; leurs versions historiques restent conservées. Un brouillon n’est jamais présenté comme jouable. Les dossiers politiques sensibles ne sont pas artificiellement corrigés.
- Progression invitée locale, progression connectée synchronisée, partage volontaire du lien et d’un message de fin de parcours.
- Administration protégée par identifiants utilisateurs autorisés ; édition structurée, publication versionnée, statistiques agrégées et export CSV.
- Le site historique dans `dist/` n’est pas modifié. Son Worker Cloudflare reste indépendant.

## Développement

Node 24 et npm. Depuis la racine :

```sh
npm ci
npm run db:local
DEV_ORIGIN=http://localhost:4173 npm run dev
```

Le front et l’API sont servis par le proxy de développement sur `http://localhost:4173`, API sous `/backend`. Le proxy supporte aussi les WebSockets du serveur Next. En prévisualisation gérée, le superviseur utilise `terminal.local:4173`.

La connexion Google est réellement désactivée tant que ses secrets ne sont pas définis. Aucun compte de démonstration, aucune route de contournement de l’authentification n’existe dans l’application livrée. Les tests injectent leur service d’authentification dans la factory Hono, uniquement dans le code de test.

## Vérifications

```sh
npm run content:check
npm run typecheck
npm test
npm run build
npm run db:local
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Les tests API utilisent le vrai moteur D1 local via Miniflare : migrations, contraintes, suppressions en cascade, idempotence, publication, autorisations et seuils statistiques. Les tests navigateur couvrent Chromium desktop, Pixel 7 et iPhone 13 / WebKit. Le test de formulaire connecté simule explicitement la réponse `/me` ; il ne valide pas le fournisseur Google.

La CI `Quiz checks` lance ces vérifications sur les modifications de l’application. Les seuls changements de `dist/` ne la déclenchent pas. Le déploiement des quiz est un workflow distinct, lancé manuellement ou par un push explicite sur la branche `release/quizz`. Il exige aussi la réussite des tests navigateur avant toute migration distante.

## Configuration de production requise

Le dépôt contient la configuration de deux Workers : `nouvel-ordre-quizz` (assets Next exportés) et `nouvel-ordre-api` (API). L’identifiant D1 zéro est un placeholder volontaire et ne peut pas être utilisé par le script de configuration de production.

1. Créer la base avec juridiction UE **au moment de sa création** :

```sh
npx wrangler d1 create nouvel-ordre --jurisdiction eu
```

2. Renseigner les variables GitHub de l’environnement `production` : `D1_DATABASE_ID`, `PUBLISHER_CONTACT`. Renseigner ses secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` avec les droits minimaux Workers, domaines et D1 requis. Ne jamais les committer.
3. Créer un client Google OAuth de type application Web :
   - origine Web : `https://quizz.nouvel-ordre.fr`
   - callback : `https://api.nouvel-ordre.fr/api/auth/callback/google`
   - scopes : identité (`openid`, `email`, `profile`), aucun accès Gmail.
4. Définir dans le Worker API les secrets `BETTER_AUTH_SECRET` (aléatoire, 32 caractères minimum), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. L’interface authentifiée ne peut pas être testée de bout en bout sans ce client réel.
5. Lancer `Deploy quiz application` depuis Actions (après intégration du workflow à la branche principale), ou créer/mettre à jour explicitement la branche `release/quizz` sur le commit vérifié. Le workflow valide, compile, applique les migrations, puis déploie les deux Workers avec leurs domaines personnalisés. Les domaines doivent appartenir au compte Cloudflare autorisé. Le Worker actuel `nouvelordre` et les routes de `nouvel-ordre.fr` ne sont pas réaffectés.
6. Après une première connexion, ajouter l’identifiant interne du propriétaire (pas son email, pas celui d’un visiteur) à `ADMIN_USER_IDS` dans `apps/api/wrangler.jsonc`, puis redéployer. Valeur vide par défaut : aucun administrateur.
7. Vérifier le vrai aller-retour Google, la reprise inter-appareils, les domaines HTTPS et la politique de confidentialité avant l’ouverture des comptes.

Les cookies de session appartiennent à l’API, sont HttpOnly et Secure en HTTPS. Le front envoie les requêtes avec credentials ; CORS et les contrôles d’origine autorisent seulement le front configuré.

## Données et méthode

- `quizzes` : 120 titres, catégories, plans et pointeur vers la version courante.
- `quiz_versions` : versions publiées immuables, questions, propositions, corrections, nuances, sources. Les participations restent attachées à leur version.
- `quiz_drafts` : brouillons modifiables sans effet sur le public.
- `progress` : étape et complétion seulement. Aucune réponse détaillée sans opt-in à l’étude.
- `research_participants` : identifiant pseudonyme, lien vers le compte, consentement explicite et profil facultatif.
- `research_answers` : première réponse par participant/question/version, profil démographique au moment de la réponse.
- `perceptions` : perception avant/après, facultative, sans bonne réponse. L’étape avant est refusée après une première réponse ; l’étape après nécessite la complétion.

Le schéma n’infère pas une orientation politique individuelle. Les données sont pseudonymisées et demeurent personnelles. Les profils ne sont pas anonymes. Les comptes Google ne garantissent pas une personne physique unique, et les premières réponses ne garantissent pas l’absence d’exposition antérieure hors site.

L’étude est réservée aux adultes qui ont explicitement accepté. Les champs démographiques sont facultatifs. Refuser ne modifie pas l’accès aux quiz. Le retrait supprime le participant et ses réponses/perceptions en cascade. Les données d’étude et le consentement expirent au plus tard après 12 mois via le cron quotidien. L’export personnel et la suppression du compte sont disponibles dans le compte.

Les statistiques ne décrivent que les participants volontaires, jamais « les Français ». Seules les premières réponses conservées sont comptées ; les tentatives répétées ne les remplacent pas. Les questions ultérieures sont déjà susceptibles d’être influencées par les explications précédentes. Une évolution avant/après ne démontre pas un effet causal durable.

Un seul axe démographique par requête, pas de filtres croisés libres. Une distribution est entièrement masquée si le groupe compte moins de 20 participants ou si une cellule non vide compte moins de 5 personnes. Ces seuils réduisent un risque ; ils ne constituent pas une preuve d’anonymisation. Les exports administrateur contiennent uniquement les agrégats non masqués. Pas d’export global nominatif des opinions.

## Ligne éditoriale et sources

Chaque QCM publié exige quatre propositions distinctes, une seule réponse définie, une explication, une nuance et au moins une URL HTTPS d’un domaine institutionnel autorisé. La liste est dans `packages/shared/sources.ts`. Une URL sur un domaine officiel n’est pas à elle seule une preuve : l’administrateur doit confirmer que le document soutient effectivement la correction.

Les sources sont des documents précis, avec institution, titre et date de consultation. Une citation de parti peut établir ce que ce parti déclare, sans démontrer sa véracité ; la liste actuelle privilégie les archives parlementaires et institutionnelles. Les corrections ne demandent pas au lecteur d’adhérer à un verdict global sur un groupe politique.

Les scripts `build-outline.mjs`, `initial-content.mjs` et `seed.mjs` reconstruisent le seed initial. Ne pas modifier une migration déjà appliquée en production pour changer les contenus : utiliser l’administration (nouvelle version) ou une nouvelle migration. Le seed est idempotent et ne remplace pas une version existante.

## Refonte éditoriale du 23 octobre 2026

Première série : q001 (aides et travail), q011 (coût des allocations, version 2), q041 (immigration et aides), q076 (classement et programme RN). Chaque parcours contient 12 questions, quatre choix plausibles, une explication, une nuance et des documents officiels datés. Les nouveaux identifiants de questions évitent de mélanger les mesures de compréhension avec les anciennes questions. Les données historiques ne sont ni effacées ni rattachées à la nouvelle version.

Les titres sont des affirmations à examiner, pas des verdicts. Les programmes archivés par la CNCCEP attestent uniquement les propositions des candidats à la date citée. Une décision administrative ne devient pas une condamnation pénale. Les exemples de budgets inventés sont signalés ; ils ne sont pas des simulations de droits. Les statistiques 2021, 2022 et 2024 sont explicitement datées, même lorsque leur publication est plus récente.

Les neuf parcours courts restants ne sont pas présentés comme réécrits. Les 107 brouillons ne sont pas des quiz complets. La suite éditoriale doit privilégier les controverses sociales contemporaines et atteindre 10–12 questions documentées par parcours, sans allonger artificiellement avec des questions de définition.

La migration 0003 ajoute les nouvelles versions ; ne pas relancer les générateurs du seed initial pour republier du contenu. Le test D1 applique toutes les migrations, vérifie l’égalité du contenu stocké avec le JSON, et conserve l’accès explicite aux versions historiques.
