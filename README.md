# Projet YSpotify API

## Description
Ce projet est une application web permettant aux utilisateurs de créer des groupes, de rejoindre des groupes existants, de synchroniser leur musique avec d'autres utilisateurs du même groupe, et bien plus encore. Il intègre également des fonctionnalités telles que la consultation des groupes et des utilisateurs, la personnalisation de l'utilisateur en fonction de ses préférences musicales, la synchronisation de la musique entre les membres d'un groupe, et la création de playlists Spotify.

## Composition de l'équipe
- Enzo CHAMANIER
-----------------------------------------------------

## Technologies Utilisées
- Langages: HTML, EJS, CSS
- Frameworks: Express.js
- Mon API: JSON
- Web API et Services: Spotify API
- Outils de développement: Node.js, npm

## Installation
1. Clonez ce dépôt sur votre machine locale.
2. Assurez-vous d'avoir Node.js installé.
3. Installez les dépendances en exécutant `npm install`.
4. Démarrez le serveur en exécutant `nodemon server.js` ou `node server.js`.
5. Accédez à l'application dans votre navigateur en visitant `http://localhost:3000`.

## Utilisation de Swagger pour la documentation de l'API

YSpotify utilise Swagger pour documenter et tester les endpoints de l'API. Pour accéder à la documentation Swagger et interagir avec l'API :

1. Assurez-vous que le serveur YSpotify est en cours d'exécution en utilisant la commande `npm start`.
2. Ouvrez votre navigateur et accédez à `http://localhost:3000/api-docs` pour afficher l'interface utilisateur Swagger.
3. Explorez la liste des endpoints disponibles. Vous pouvez développer chaque endpoint pour voir les détails et tester les requêtes directement dans l'interface utilisateur.
4. Pour tester un endpoint, cliquez sur `Try it out`, remplissez les paramètres requis, et cliquez sur `Execute`. Vous pouvez voir la requête CURL générée et la réponse de l'API.
5. Utilisez la section d'autorisation de Swagger UI pour entrer des jetons d'accès si votre API nécessite une authentification.
6. Consultez les modèles de réponse pour comprendre la structure des réponses attendues pour chaque endpoint.
7. Si vous effectuez des modifications dans votre API, n'oubliez pas de mettre à jour les commentaires JSDoc dans votre code source pour que Swagger UI reflète ces changements après le redémarrage du serveur.

La documentation Swagger est un outil précieux pour comprendre et tester l'API YSpotify. Elle est mise à jour en temps réel avec le code source, ce qui garantit que la documentation est toujours synchronisée avec la dernière version de l'API.


-----------------------------------------------------
## Fonctionnalités

### FT-1 Création de Groupes (fait)
Les utilisateurs peuvent créer des groupes et devenir automatiquement le chef du groupe.

### FT-2 Rejoindre un Groupe (fait)
Les utilisateurs peuvent rejoindre des groupes existants. S'ils tentent de rejoindre un groupe qui n'existe pas, le groupe est automatiquement créé et l'utilisateur en devient le chef.

### FT-3 Quitter un Groupe (fait)
Les utilisateurs peuvent quitter un groupe auquel ils appartiennent. Si l'utilisateur qui quitte le groupe est le chef, un nouveau chef est aléatoirement assigné parmi les membres restants.

### FT-4 Rejoindre un Groupe (fait)
Les utilisateurs peuvent rejoindre un groupe. Si l'utilisateur appartient déjà à un groupe, il quitte automatiquement le groupe précédent avant de rejoindre le nouveau.

### FT-5 Consultation des Groupes et Utilisateurs (fait)
Les utilisateurs peuvent consulter la liste de tous les groupes existants sur le service, ainsi que la liste des membres de chaque groupe.

### FT-6 Personnalité de l’Utilisateur (pas fait)
Le service est capable de déduire la personnalité de l'utilisateur en fonction de ses "Titres Likés".

### FT-7 Synchronisation (pas fait)
Le chef d'un groupe peut synchroniser la musique qu'il est en train d'écouter sur tous les appareils actifs des autres utilisateurs appartenant à son groupe.

### FT-8 Playlist (pas fait)
Les utilisateurs peuvent demander la création d'une playlist sur leur compte Spotify contenant les 10 musiques préférées d'un autre utilisateur passé en paramètre.



