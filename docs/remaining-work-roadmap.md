# Watchly, roadmap du travail restant

Mise à jour: 12 août 2026

Ce document classe le travail restant par priorité. Il ne signifie pas que chaque fonctionnalité part de zéro. L'onboarding, les alertes internes, les profils publics et les pages d'épisodes possèdent déjà une base qui doit être terminée et validée.

## Principes de réalisation

- P0 regroupe les prérequis nécessaires avant une bêta publique.
- P1 regroupe les fonctions centrales qui renforcent la rétention et l'usage quotidien.
- P2 regroupe les personnalisations, intégrations secondaires et extensions coûteuses.
- Chaque chantier doit être validé par des tests ciblés, les vérifications globales pertinentes et un parcours sur iPhone réel lorsque le comportement natif est concerné.
- Le staging, la production et le développement local doivent rester strictement séparés.
- Les pages légales sont publiques. La console de modération et ses données sont privées et fortement protégées.

## P0, prérequis avant bêta publique

### 1. Staging, déploiement et monitoring

Objectif: disposer d'un environnement réaliste et observable avant d'exposer Watchly à des utilisateurs externes.

Travail prévu:

- Créer une API et une base de données staging séparées du développement et de la production.
- Utiliser des secrets, identifiants Firebase, URLs et configurations propres au staging.
- Produire un build mobile de staging clairement identifiable et connecté uniquement au staging.
- Ajouter des logs structurés avec identifiant de requête et contexte utile sans exposer de secrets ni de données sensibles.
- Ajouter le suivi des erreurs API et le crash reporting mobile.
- Surveiller la disponibilité de l'API, les erreurs, la latence, la base de données et les tâches de fond.
- Déclencher des alertes exploitables en cas d'indisponibilité, de hausse d'erreurs ou d'échec répété d'une tâche planifiée.
- Documenter le déploiement, les migrations, les smoke tests, le rollback et la restauration de sauvegarde.
- Préparer des tableaux de bord séparés pour staging et production.

Critères de validation:

- Un build mobile staging ne peut pas écrire dans la production.
- Une erreur volontaire est visible dans les logs et le suivi d'erreurs avec le bon environnement.
- Une indisponibilité de test déclenche une alerte.
- Le déploiement et le rollback sont reproductibles à partir de la documentation.
- Les secrets ne sont présents ni dans le dépôt, ni dans le bundle mobile, ni dans les logs.

### 2. Source unique des événements de sortie

Objectif: alimenter le calendrier, les alertes internes et les notifications push avec les mêmes données normalisées.

Flux cible:

`TMDB -> ReleaseEvent -> calendrier / alertes internes / notifications push`

Travail prévu:

- Définir un modèle `ReleaseEvent` commun aux films, saisons et épisodes.
- Stocker l'identité du contenu, le type d'événement, la date, le fuseau ou la précision connue, la région si nécessaire et la provenance.
- Dédupliquer les événements et rendre leur synchronisation idempotente.
- Gérer les changements, reports et suppressions de dates sans créer de fausses nouvelles sorties.
- Mettre en place une synchronisation planifiée et observable depuis TMDB.
- Définir une politique claire pour les dates incomplètes, inconnues ou dépendantes du territoire.
- Faire consommer cette source par les alertes internes existantes avant de construire le calendrier et le push.

Critères de validation:

- Une même sortie possède un seul événement canonique.
- Une modification TMDB met à jour l'événement existant sans doublon.
- Un report corrige les futures alertes déjà planifiées.
- Le calendrier, la boîte d'alertes et le push ne recalculent pas indépendamment les dates.
- Les échecs et retards de synchronisation sont visibles dans le monitoring.

### 3. Webapp publique et console de modération sécurisée

Objectif: fournir les pages requises pour les stores et un point de contrôle sécurisé pour la modération.

Architecture proposée:

- Ajouter une webapp dédiée dans le monorepo, par exemple `apps/web`.
- Servir les pages légales publiquement via HTTPS et des URLs stables.
- Isoler la console privée sous une zone comme `/admin`.
- Utiliser l'API NestJS existante pour les données et actions de modération.

Partie publique:

- Politique de confidentialité.
- Conditions d'utilisation.
- Règles de la communauté.
- Page de support et contact.
- Instructions ou lien de suppression de compte.
- Liens vers les documents depuis l'application mobile.
- Pages responsive, accessibles, indexables et disponibles sans authentification.

Partie privée:

- Authentification forte et MFA pour les administrateurs.
- Autorisations administrateur vérifiées par l'API à chaque requête.
- Aucun rôle administrateur accordé uniquement par une valeur contrôlée dans le client.
- Liste paginée et filtrable des signalements.
- Affichage du contexte utile pour un profil, un avis ou un contenu signalé.
- Statuts de traitement: nouveau, en cours, résolu et rejeté.
- Actions de modération explicites avec confirmation.
- Journal d'audit immuable des consultations sensibles et des actions.
- Protection contre les accès directs non autorisés, les abus de session et les attaques web courantes.
- Minimisation des données personnelles visibles par la console.

Critères de validation:

- Les URLs légales publiques fonctionnent sans compte et peuvent être fournies aux stores.
- `/admin` refuse tout utilisateur non autorisé côté serveur.
- Une action de modération indique qui l'a effectuée, quand, pourquoi et sur quelle cible.
- Un signalement peut être traité de sa création jusqu'à sa résolution.
- Les pages publiques restent disponibles même si la console privée rencontre une erreur.

### 4. Finaliser les profils publics et les interactions sociales en cours

Objectif: stabiliser le chantier actuel avant d'ajouter une nouvelle personnalisation du profil.

Travail prévu:

- Terminer les profils ouverts depuis la recherche People.
- Finaliser abonnements, demandes, blocage, déblocage et signalement.
- Respecter les profils publics, privés et les relations de blocage.
- Conserver une hiérarchie cohérente entre le profil propriétaire et le profil public.
- Terminer le chargement progressif, les états vides, les erreurs et les protections de données privées.
- Valider les modifications actuellement présentes dans le worktree avant d'élargir le périmètre.

Critères de validation:

- Les parcours recherche, profil public, follow, block, unblock et report fonctionnent sur appareil réel.
- Un profil privé ou bloqué ne divulgue aucune activité protégée.
- Les compteurs et états de relation restent cohérents après navigation et rechargement.
- Les logs Metro et API restent propres pendant le parcours.

### 5. Terminer l'onboarding

Objectif: rendre la première utilisation courte, claire, fiable et utile sans reconstruire le parcours existant.

Travail prévu:

- Finaliser le choix du nom et du handle permanent.
- Garder la sélection de premiers films et séries facultative.
- Simplifier l'explication des valeurs de confidentialité si elle ne demande aucune décision.
- Gérer la disponibilité du handle, les erreurs réseau, les retours en arrière et les reprises.
- Empêcher les doubles soumissions et les états partiellement incohérents.
- Conserver un parcours spécifique pour les anciens comptes qui doivent seulement choisir un handle.
- Vérifier le clavier, les petits écrans, l'accessibilité et les états de chargement.

Critères de validation:

- Un nouveau compte peut terminer le parcours sur iPhone réel.
- Un utilisateur peut terminer sans sélectionner de titre.
- Un handle déjà pris affiche une erreur claire sans perdre les autres saisies.
- Un onboarding terminé ne réapparaît pas.
- Un ancien compte sans handle suit uniquement le parcours de récupération prévu.

### 6. Finaliser Google OAuth, ajouter Apple OAuth et la liaison des comptes

Objectif: proposer des connexions réellement fonctionnelles et éviter la création de comptes Watchly en double.

Travail prévu:

- Finaliser la configuration Google dans Firebase et les consoles natives.
- Valider Google sur iPhone et Android réels, avec les bons redirects et identifiants par environnement.
- Ajouter Sign in with Apple et sa configuration Firebase, Apple Developer et native.
- Définir et implémenter la liaison de plusieurs fournisseurs au même compte Watchly.
- Gérer annulation, refus, erreur, jeton expiré, reconnexion et suppression de compte.
- Maintenir uniquement Google, Apple, Microsoft et Discord comme fournisseurs de connexion.
- Vérifier le respect des exigences Apple lorsque d'autres fournisseurs sociaux sont proposés.

Critères de validation:

- Google et Apple fonctionnent de bout en bout sur appareil réel.
- Les identités staging et production restent séparées.
- La liaison de comptes ne duplique ni le profil, ni l'activité, ni le handle.
- Une annulation OAuth ramène proprement dans l'application.
- Aucun bouton visible ne simule un fournisseur non disponible.

### 7. Ajouter la liste des utilisateurs bloqués

Objectif: permettre à l'utilisateur de consulter et gérer les comptes qu'il a lui-même bloqués.

Travail prévu:

- Ajouter une route API paginée listant uniquement les utilisateurs bloqués par le compte courant.
- Retourner uniquement l'identité publique nécessaire: identifiant, avatar, nom, handle et date de blocage.
- Ajouter `Settings > Privacy > Blocked users`.
- Proposer un déblocage avec confirmation et mise à jour immédiate de la liste.
- Gérer chargement, liste vide, pagination, erreur et nouvelle tentative.
- Ne jamais exposer la liste des utilisateurs qui ont bloqué le compte courant.

Critères de validation:

- Un utilisateur ne peut lire ou modifier que sa propre liste.
- Le déblocage met à jour la relation et les profils concernés.
- La pagination ne produit ni doublons ni omissions.
- La liste reste vide pour un compte sans blocage et ne divulgue aucune relation inverse.

## P1, fonctions centrales après les fondations

### 8. Calendrier personnel des sorties futures

Objectif: donner une vue utile des prochaines sorties liées aux intérêts réels de l'utilisateur.

Travail prévu:

- Alimenter exclusivement le calendrier depuis `ReleaseEvent`.
- Inclure les titres suivis, watchlistés ou associés à une alerte activée selon la règle produit retenue.
- Afficher films, saisons et épisodes.
- Fournir une vue agenda et une vue mensuelle.
- Ajouter les filtres All, Movies et Series.
- Permettre d'ouvrir le contenu et d'activer ou retirer une alerte depuis le calendrier.
- Gérer les dates déplacées et inconnues sans afficher de fausses précisions.

Critères de validation:

- Le calendrier est personnel et ne duplique pas simplement Explore Coming soon.
- Une modification de `ReleaseEvent` est reflétée sans délai incohérent.
- Les actions d'alerte restent cohérentes entre calendrier, catalogue et Library.

### 9. Notifications push et préférences

Objectif: prolonger la boîte d'alertes existante avec des notifications système fiables.

Travail prévu:

- Ajouter `expo-notifications` ou la solution retenue et reconstruire le client natif.
- Demander l'autorisation au moment où l'utilisateur active une fonction qui en a besoin.
- Enregistrer les appareils et jetons push par utilisateur et environnement.
- Gérer renouvellement, révocation, déconnexion et nettoyage des jetons invalides.
- Envoyer les sorties depuis `ReleaseEvent` et les événements sociaux depuis leurs sources canoniques.
- Ajouter les liens profonds vers le contenu ou l'action concernée.
- Ajouter des préférences par catégorie et un interrupteur global.
- Dédupliquer les notifications internes et push.

Priorité des catégories:

1. Sorties suivies.
2. Demandes de suivi.
3. Invitations et résultats de listes partagées.
4. Notifications sociales secondaires plus tard.

Critères de validation:

- Une notification arrive sur appareil réel en arrière-plan et application fermée.
- Le toucher ouvre la bonne destination.
- Un utilisateur désinscrit ne reçoit plus la catégorie désactivée.
- Les jetons staging ne sont jamais utilisés par la production.
- Un même événement ne génère pas plusieurs push identiques.

### 10. Améliorer les pages de saisons et d'épisodes

Objectif: faciliter la navigation, le suivi et la reprise d'une série.

Travail prévu:

- Repenser en priorité la page de saison, moins avancée que la fiche épisode.
- Ajouter un sélecteur de saison rapide.
- Mettre en avant le prochain épisode utile.
- Étudier une action explicite pour marquer une saison comme vue.
- Ajouter la navigation vers l'épisode précédent et suivant.
- Améliorer la hiérarchie entre synopsis, activité personnelle, communauté, casting et détails.
- Protéger les synopsis ou avis comportant des spoilers.
- Conserver le suivi, les vues, notes, avis et crédits déjà disponibles.

Critères de validation:

- L'utilisateur atteint le prochain épisode avec moins d'actions.
- Les changements de progression sont cohérents dans la saison, la série, Home et Library.
- Les épisodes non sortis ne proposent pas d'actions incohérentes.
- La page reste fluide avec une saison longue.

## P2, extensions à réaliser après retours d'usage

### 11. Personnaliser l'ordre des sections du profil

Objectif: permettre une personnalisation simple sans complexifier prématurément le profil.

Travail prévu:

- Ajouter un écran `Edit profile layout`.
- Permettre `Move up`, `Move down` et `Hide` plutôt qu'un drag-and-drop fragile pour la première version.
- Définir les sections obligatoires qui ne peuvent pas être masquées.
- Appliquer le même ordre au profil propriétaire et au profil public.
- Prévoir un retour à l'ordre par défaut.

### 12. OAuth secondaires

Travail prévu:

- Étudier Microsoft OAuth après Google et Apple.
- Conserver Discord et Microsoft comme fournisseurs secondaires; Facebook reste hors périmètre.
- Masquer chaque fournisseur jusqu'à son implémentation et sa validation réelle.

### 13. Connexions Trakt ou services de streaming

Travail prévu:

- Distinguer la connexion à Watchly de la synchronisation d'un historique externe.
- Privilégier Trakt ou un partenaire contractuel plutôt que la collecte directe de mots de passe de streaming.
- Vérifier couverture, qualité des données, confidentialité, suppression, coûts et conditions commerciales.
- Commencer par une bêta limitée avec plafond de dépenses si une solution payante est retenue.
- Ne pas promettre une synchronisation universelle, instantanée ou une position de lecture exacte.

### 14. Extensions du calendrier et notifications sociales secondaires

Travail prévu:

- Ajouter des vues, widgets ou filtres avancés seulement après mesure de l'usage du calendrier initial.
- Étudier les notifications de likes et autres interactions sociales après les catégories prioritaires.
- Ajouter des regroupements et résumés pour éviter le bruit notificationnel.

## Ordre d'exécution recommandé

1. Stabiliser et valider le chantier actuel des profils publics.
2. Mettre en place le staging, le déploiement reproductible et le monitoring.
3. Définir puis implémenter `ReleaseEvent` comme source unique.
4. Créer la webapp publique et la console de modération sécurisée.
5. Terminer et valider l'onboarding.
6. Finaliser Google, ajouter Apple et sécuriser la liaison des comptes.
7. Ajouter la liste des utilisateurs bloqués.
8. Construire le calendrier personnel sur `ReleaseEvent`.
9. Ajouter les notifications push et leurs préférences.
10. Améliorer les pages saisons et épisodes.
11. Mesurer les usages avant de démarrer les éléments P2.

## Règle de livraison

Chaque point doit être découpé en unités logiques avec critères d'acceptation, validation ciblée et commit dédié. Les commits validés peuvent être accumulés, puis le push doit attendre la validation complète du jalon parent sauf demande contraire explicite.
