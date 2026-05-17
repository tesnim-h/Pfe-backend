# Seed de la base de données

Ce document explique comment remplir la base de données de `Fennekybk` avec des données de départ.

## Objectif

Le script `scripts/seed.js` crée une base de données de démonstration complète pour le premier démarrage.
Il génère des données réalistes pour :

- pays et villes
- utilisateurs (admin / mentor / learner)
- profils mentor et learner
- catégories de compétences
- compétences et compétences mentor
- demandes de mentorat
- preuves de compétence
- demandes de validation
- conversations et messages
- sessions et évaluations
- notifications
- audit logs
- soldes et transactions de crédits
- paramètres système
- statistiques de plateforme

## Pré-requis

1. Avoir installé les dépendances :

```bash
npm install
```

2. Avoir défini l’URL MongoDB dans `MONGODB_URI`.
3. Optionnel : définir `SEED_DEFAULT_PASSWORD` pour le mot de passe par défaut.

### Exemple de `.env`

```env
MONGODB_URI=mongodb://localhost:27017/fenneky
SEED_DEFAULT_PASSWORD=Password123!
```

## Commandes disponibles

- Charger les données initiales :

```bash
npm run seed
```

- Réinitialiser les collections et recharger les données :

```bash
npm run seed:reset
```

## Seed automatique au démarrage

À la première ouverture de l’application, si la base de données est vide, le serveur remplit automatiquement les données de démonstration.

Pour désactiver ce comportement en environnement de développement, définis :

```bash
AUTO_SEED_ON_STARTUP=false
```

## Comptes de démonstration

Le script affiche le mot de passe par défaut en fin d’exécution.
Par défaut, il utilise :

- `admin@fenneky.dev`
- `mentor@fenneky.dev`
- `learner@fenneky.dev`

Si `SEED_DEFAULT_PASSWORD` n’est pas défini, le mot de passe est :

```text
Password123!
```

## Notes importantes

- Le script vérifie que `MONGODB_URI` est défini.
- `npm run seed:reset` supprime d’abord toutes les collections seedées avant de réinsérer les données.
- Le seed fonctionne en mode `upsert`, donc il met à jour les documents existants si les identifiants sont les mêmes.

## Contenu de la seed

Le seed charge notamment :

- `countries`, `cities`
- `users`, `learners`, `admins`, `mentors`
- `skill categories`, `skills`, `mentor skills`
- `mentor applications`, `mentor credentials`
- `skill evidence`, `validation requests`
- `conversations`, `messages`
- `session requests`, `sessions`, `session reviews`
- `notifications`, `audit logs`
- `credit balances`, `credit transactions`
- `system settings`, `platform statistics`

Cela permet de démarrer avec une base de données complète et cohérente.
