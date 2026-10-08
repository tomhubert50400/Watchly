# Règles de travail pour Watchly

Ces règles s'appliquent à tout le dépôt. Ce fichier contient les conventions durables du projet et peut être complété à la demande de l'utilisateur. Le code actuel fait foi pour les chemins et les implémentations.

## 1. Rechercher avant de créer

- Avant toute implémentation, chercher les fonctionnalités similaires dans le dépôt avec `rg` et `rg --files`, y compris dans les dossiers métier, pas seulement dans `components`.
- Lire l'implémentation trouvée, ses usages et les tests pertinents. Un nom de fichier ou un résultat de recherche ne suffit pas.
- Avant de modifier le code, indiquer brièvement les fichiers de référence, ce qui sera réutilisé et la différence réellement nécessaire.
- Ne pas affirmer qu'un composant ou une logique n'existe pas sans avoir cherché par comportement, noms proches et usages.
- Si plusieurs implémentations existent et que la référence attendue reste ambiguë, demander laquelle suivre avant de coder.

## 2. Réutiliser avant de dupliquer

- Pour deux fonctionnalités censées être identiques, utiliser la même implémentation partagée : composants, hooks, services, utilitaires et règles métier selon le besoin.
- « Faire comme X » signifie examiner X et réutiliser ses éléments et son comportement, pas reconstruire une approximation visuelle.
- Ordre de préférence : réutiliser tel quel, composer les éléments existants, étendre minimalement l'existant, puis seulement créer une nouvelle implémentation si nécessaire.
- Ne pas copier-coller un composant, des styles ou une logique pour les renommer dans une autre fonctionnalité.
- Si le code réutilisable est intégré dans un écran, extraire seulement la partie nécessaire et l'utiliser aux deux endroits concernés, en préservant le comportement d'origine.
- Avant de créer un équivalent séparé, expliquer précisément pourquoi l'existant ne convient pas. Une différence métier ou de plateforme peut justifier une séparation ; la commodité seule ne suffit pas.
- Ne pas introduire une abstraction générale, une dépendance ou une multitude d'options pour un besoin ponctuel.

## 3. Garder une interface cohérente

- Réutiliser les composants et les tokens du projet pour les couleurs, espacements, typographies, boutons, champs, cartes, menus et feuilles modales.
- Pour une fonctionnalité équivalente, préserver aussi les interactions : ouverture, fermeture, gestes, clavier, chargement, erreurs, état vide et accessibilité.
- Vérifier les consommateurs d'un composant partagé avant de changer son contrat ou son comportement par défaut.
- Une différence intentionnelle doit rester explicite et limitée au besoin demandé.

### En-têtes mobiles sans bande de fond

- Pour toute nouvelle page mobile ou modification d'un en-tête, suivre le fonctionnement des watchlists personnelles et partagées dans `apps/mobile/src/watchlists/WatchlistDetailLayout.tsx` : conserver les boutons natifs Liquid Glass et laisser le fond de la page visible derrière eux, en haut de page comme pendant le défilement.
- Pour les pages avec navigation native, réutiliser `rootStackScreenOptions` dans `apps/mobile/src/navigation/stackConfig.ts` et le montage de `apps/mobile/App.tsx` : en-tête transparent, sans ombre ni flou de barre, avec `scrollEdgeEffects.top: 'hidden'`. Ne pas supprimer l'en-tête natif ni remplacer ses boutons par des boutons personnalisés pour faire disparaître son fond.
- Utiliser `apps/mobile/src/components/NativeHeaderTitle.tsx` comme vue de titre via `headerTitle`, comme les watchlists. Ne pas réintroduire le titre standard d'iOS sur les pages titrées ; conserver `title` pour le libellé de navigation et laisser les pages sans titre sans texte ajouté.
- Réutiliser `Screen` et `ScreenTopFade` pour les pages classiques, et `WatchlistPage` pour les watchlists. Le fondu supérieur doit utiliser `insets.top`, jamais la hauteur complète de l'en-tête natif. La hauteur de navigation sert séparément à espacer le contenu, sans appliquer deux fois la zone de sécurité.
- Conserver les écrans racines qui possèdent déjà leur propre en-tête, comme l'accueil, sans leur ajouter une seconde barre. Pour une liste virtualisée, préserver son conteneur et réutiliser les mêmes composants de titre et règles d'espacement, sans l'imbriquer dans un autre défilement.
- Vérifier les tests `navigation/nativeHeaderCoverage.qa.ts` et `watchlists/watchlistDetailLayout.qa.ts`, puis contrôler sur iPhone l'absence de bande au repos et après défilement, les boutons retour/favoris/menus et leur restauration après un glisser-déposer. Une validation automatisée ne prouve pas le rendu natif.

Points de départ à vérifier dans le code actuel, sans limiter la recherche à cette liste :

- `apps/mobile/src/components/` : composants communs, dont `Button`, `TextInput`, `MediaPoster`, `Screen` et `BottomActionSheet`.
- `apps/mobile/src/design/tokens.ts` : tokens visuels.
- `apps/mobile/src/cache/` : cache et chargement partagé, dont `useCachedResource`.
- `apps/mobile/src/watchlists/WatchlistDetailLayout.tsx` : structure partagée des détails de watchlist.
- Les dossiers métier de `apps/mobile/src/` et `apps/api/src/` : comportements et services existants.

## 4. Faire des changements ciblés

- Énoncer les hypothèses et, pour une tâche en plusieurs étapes, un plan court avec les vérifications prévues.
- Si une information indispensable manque, poser une question ciblée plutôt que deviner ou multiplier les essais.
- Implémenter uniquement le besoin demandé, dans le style du code existant.
- Préserver les modifications déjà présentes. Ne pas nettoyer, reformater ou refactorer les fichiers voisins sans nécessité.
- Retirer les imports et le code rendus inutiles par sa propre modification. Signaler les problèmes préexistants sans les corriger hors périmètre.

## 5. Vérifier la réutilisation et les régressions

- Pour un correctif de comportement, ajouter ou adapter un test pertinent qui reproduit le problème lorsque c'est automatisable.
- Lorsqu'un élément partagé change, vérifier la nouvelle fonctionnalité et les usages existants affectés.
- Exécuter les contrôles adaptés à la modification. `pnpm check` regroupe lint, typecheck et tests du dépôt ; une modification documentaire seule ne nécessite pas de lancer l'application.
- Pour une modification visuelle ou gestuelle, distinguer les contrôles automatisés de la validation dans l'application et sur appareil. Ne pas prétendre avoir observé un rendu sans l'avoir vérifié.
- Relire le diff : chaque ligne doit servir la demande, sans duplication évitable ni changement annexe.
- À la livraison, résumer ce qui a été réutilisé, les vérifications effectuées, les limites restantes et la prochaine étape utile.

## 6. Commits et communication

- Lorsqu'un commit ou un push est demandé, séparer le travail en petits commits logiques avec des messages descriptifs.
- Ne pas regrouper des commits existants par squash, utiliser le préfixe `auto:`, ni ajouter de ligne `Co-Authored-By`.
- Ne pas utiliser de tiret cadratin dans les textes produits.
- Signaler une approche plus simple ou une incohérence avec la demande lorsqu'elle est identifiée.

## 7. Ajouter des règles au fil du projet

Ajouter les nouvelles règles dans la section concernée, avec une formulation concrète et vérifiable. Si une règle change, corriger l'ancienne au lieu de conserver deux consignes contradictoires. Ne pas transformer ce fichier en journal de tâches.

Format conseillé : « Pour [cas précis], réutiliser [composant ou fichier de référence] et vérifier [comportement attendu]. »

### Règles supplémentaires de l'utilisateur

<!-- Ajouter ici les prochaines règles validées par l'utilisateur. -->
