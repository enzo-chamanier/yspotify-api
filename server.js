// Assurez-vous que tous les require nécessaires sont présents au début du fichier
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises; 
const path = require('path');
const crypto = require('crypto'); 
const uuid = require('uuid'); 
const { exit } = require('process');
const app = express();
const port = 3000;
const usersFilePath = path.join(__dirname, 'users.json');
const groupesListe = ['Groupe A', 'Groupe B', 'Groupe C', 'Groupe D'];
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swaggerConfig');

// Assurez-vous que le fichier .env est bien chargé
require('dotenv').config();

// Configuration de l'application Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(session({
  secret: 'votreSecretDeSession',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));


//-----------------------------------Les fonctions en lien avec Spotify----------------------------------
// Fonction pour obtenir l'appareil actif de l'utilisateur
async function getActiveDevice(token) {
  try {
      const userData = await fs.readFile(usersFilePath, 'utf8');
      const users = JSON.parse(userData);
      const userIndex = users.findIndex(user => user.spotifyAccountToken === token);

      if (userIndex !== -1) {
          const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
              headers: { 'Authorization': `Bearer ${token}` }
          });

          const devices = response.data.devices;
          const activeDevice = devices.find(device => device.is_active);

          if (activeDevice) {
              users[userIndex].activeDevice = activeDevice;
              await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
              return activeDevice;
          } else {
              console.error('Aucun appareil actif trouvé.');
              throw new Error('NoActiveDevice');
          }
      } else {
          console.error('Utilisateur non trouvé avec le token Spotify:', token);
          throw new Error('UserNotFound');
      }
  } catch (error) {
      if (error.response && error.response.status === 401) {
          throw new Error('Unauthorized');
      } else {
          throw error; // Rethrow the original error if it's not a 401
      }
  }
}
// Fonction pour obtenir le pseudo de l'utilisateur Spotify
async function getSpotifyUsername(token) {
  try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data.display_name;
  } catch (error) {
      if (error.response && error.response.status === 401) {
          console.error('Erreur d\'authentification pour obtenir le pseudo Spotify.');
          throw new Error('Unauthorized');
      } else {
          console.error('Erreur lors de la récupération du pseudo Spotify:', error);
          throw error; // Propager l'erreur pour un traitement ultérieur
      }
  }
}
// Fonction pour obtenir les morceaux en cours d'écoute de l'utilisateur
async function getTracks(token) {
  try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data && response.data.is_playing) {
          const track = response.data.item;
          const trackDetails = {
              title: track.name,
              artist: track.artists.map(artist => artist.name).join(', '),
              album: track.album.name
          };
          return trackDetails;
      } else {
          return { message: 'Aucun morceau en cours d\'écoute.' };
      }
  } catch (error) {
      if (error.response && error.response.status === 401) {
          console.error('Erreur d\'authentification pour obtenir les morceaux en cours d\'écoute.');
          throw new Error('Unauthorized');
      } else {
          console.error('Erreur lors de la récupération du morceau en cours d\'écoute:', error);
          throw error;
      }
  }
}



//--------------------------------------Routes pour l'inscription----------------------------------------
/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: Routes pour l'inscription et la connexion des utilisateurs.
 */
/**
 * @swagger
 * /signup:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Affiche la page d'inscription.
 *     description: Retourne la page HTML pour l'inscription d'un nouvel utilisateur.
 *     responses:
 *       200:
 *         description: Page d'inscription récupérée avec succès.
 */
// Route pour la redirection vers la page d'inscription
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
/**
 * @swagger
 * /signup:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Inscrit un nouvel utilisateur.
 *     description: Permet à un nouvel utilisateur de créer un compte.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Le nom d'utilisateur souhaité.
 *               password:
 *                 type: string
 *                 description: Le mot de passe pour le compte.
 *               group:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Les groupes auxquels l'utilisateur souhaite se joindre.
 *     responses:
 *       200:
 *         description: Inscription réussie, redirection vers /main.
 *       400:
 *         description: Le nom d'utilisateur existe déjà ou les données sont manquantes.
 *       500:
 *         description: Erreur serveur interne lors de l'inscription.
 */
// Route pour l'inscription de l'utilisateur
app.post('/signup', async (req, res) => {
  const { username, password, group } = req.body;
  if (!username || !password) {
    return res.redirect('/signup');
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');

  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    const users = JSON.parse(data || '[]');
    if (users.some(user => user.username === username)) {
      return res.status(400).send('Cet utilisateur existe déjà.');
    }

    // Ajout des propriétés supplémentaires lors de la création du nouvel utilisateur
    const newUser = {
      username,
      password: hash,
      spotifyAccountToken: null,
      group: group || [],
      isLeader: false, // Ajout de la propriété isLeader
      spotifyUsername: null, // Ajout de la propriété spotifyUsername
      activeDevice: null, // Ajout de la propriété activeDevice
      currentTrack: [] // Ajout de la propriété currentTrack
    };

    users.push(newUser);
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
    // Initialiser la session de l'utilisateur avec les propriétés pertinentes
    req.session.user = {
      username: newUser.username,
      spotifyLinked: !!newUser.spotifyAccountToken,
      isLeader: newUser.isLeader,
      spotifyUsername: newUser.spotifyUsername,
      currentTrack: newUser.currentTrack
    };
    res.redirect('/main');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'utilisateur:', error);
    res.status(500).send('Erreur serveur.');
  }
});



//--------------------------------------Routes pour la connexion----------------------------------------
/**
 * @swagger
 * /signin:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Affiche la page de connexion.
 *     description: Retourne la page HTML pour la connexion d'un utilisateur existant.
 *     responses:
 *       200:
 *         description: Page de connexion récupérée avec succès.
 */
// Route pour la redirection vers la page de connexion
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});
/**
 * @swagger
 * /signin:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Connecte un utilisateur.
 *     description: Permet à un utilisateur de se connecter en fournissant un nom d'utilisateur et un mot de passe.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Le nom d'utilisateur de l'utilisateur.
 *               password:
 *                 type: string
 *                 description: Le mot de passe de l'utilisateur.
 *     responses:
 *       200:
 *         description: Connexion réussie, redirection vers /main.
 *       302:
 *         description: Redirection vers /signin en cas d'échec de connexion.
 *       500:
 *         description: Erreur serveur interne.
 */
// Route pour la connexion de l'utilisateur
app.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect('/signin');
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');

  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    let users = JSON.parse(data);
    const userIndex = users.findIndex(u => u.username === username && u.password === hash);

    if (userIndex !== -1) {
      let user = users[userIndex];


      // Préparation de l'objet activeDevice pour la session, en vérifiant d'abord si l'utilisateur a un appareil actif
      const activeDevice = user.activeDevice ? {
        id: user.activeDevice.id,
        is_active: user.activeDevice.is_active,
        is_private_session: user.activeDevice.is_private_session,
        is_restricted: user.activeDevice.is_restricted,
        name: user.activeDevice.name,
        supports_volume: user.activeDevice.supports_volume,
        type: user.activeDevice.type,
        volume_percent: user.activeDevice.volume_percent
      } : null;

      // Préparation de l'objet currentTrack pour la session, en vérifiant d'abord si l'utilisateur écoute actuellement un morceau
      const currentTrack = user.currentTrack ? {
        title: user.currentTrack.title,
        artist: user.currentTrack.artist,
        album: user.currentTrack.album
      } : null;

      // Mise à jour de la session avec les informations de l'utilisateur, y compris activeDevice et currentTrack
      req.session.user = {
        username: user.username,
        spotifyLinked: !!user.spotifyAccountToken,
        leader: user.isLeader,
        spotifyUsername: user.spotifyUsername || null,
        activeDevice: activeDevice,
        currentTrack: currentTrack,
        group: user.group
      };

      if (!user.spotifyAccountToken) {
        res.redirect('/main');
      } else {
        try {
          const spotifyUsername = await getSpotifyUsername(user.spotifyAccountToken);
          users[userIndex].spotifyUsername = spotifyUsername; // Mise à jour de l'utilisateur dans le tableau users
          req.session.user.spotifyUsername = spotifyUsername;

          // Récupération des détails du morceau en cours d'écoute
          const trackDetails = await getTracks(user.spotifyAccountToken);
          if (trackDetails && trackDetails.title) { // Assurez-vous que des détails de morceau existent
            users[userIndex].currentTrack = trackDetails;
            req.session.user.currentTrack = trackDetails;
          }

          // Mise à jour du fichier users.json avec les nouvelles informations
          await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');

          const activeDevice = await getActiveDevice(user.spotifyAccountToken);
          if (!activeDevice) {
            throw new Error('NoActiveDevice');
          }
          req.session.user.activeDevice = activeDevice;
          console.log('Appareil actif:', activeDevice);
          res.redirect('/main');
        } catch (error) {
          if (error.message === 'Unauthorized') {
            res.redirect('/loginspotify');
          } else if (error.message === 'NoActiveDevice') {
            res.redirect('/main');
          } else {
            console.error('Erreur lors de la récupération du nom d\'utilisateur Spotify, de l\'appareil actif ou des détails du morceau :', error);
            res.redirect('/main');
          }
        }
      }
    } else {
      res.redirect('/signin');
    }
  } catch (error) {
    console.error('Erreur lors de la connexion :', error);
    res.status(500).send('Erreur serveur.');
  }
});



//------------------------------------Route pour la page principale--------------------------------------
/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Page principale après connexion.
 */
/**
 * @swagger
 * /main:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Affiche la page principale après connexion.
 *     description: Charge et affiche la page principale avec les groupes de l'utilisateur et les informations de son compte Spotify.
 *     responses:
 *       200:
 *         description: Affiche la page principale avec les informations de l'utilisateur.
 *       302:
 *         description: Redirection vers /signin si l'utilisateur n'est pas connecté.
 *       500:
 *         description: Erreur serveur interne.
 */
app.get('/main', async (req, res) => {
  console.log('Session utilisateur:', req.session.user);
  try {
    // Charger les données des utilisateurs depuis le fichier
    const data = await fs.readFile(usersFilePath, 'utf8');
    let users = JSON.parse(data);
    const groupes = [];

    
    if (!req.session.user) {
      return res.redirect('/signin');
    } else if (!req.session.user.group) {
      req.session.user.group = [];
    }

    // Identifiant de l'utilisateur actuel
    const usernameActuel = req.session.user.username;

    // Pour chaque groupe, calculer le nombre d'utilisateurs et si l'utilisateur actuel est le leader
    groupesListe.forEach(groupeNom => {
      const nbUtilisateurs = users.filter(user => user.group.includes(groupeNom)).length;
      
      // Vérifier si l'utilisateur actuel est le leader de ce groupe
      const estLeaderActuel = users.some(user => user.username === usernameActuel && user.group.includes(groupeNom) && user.isLeader);

      // Ajouter le groupe avec le nombre d'utilisateurs et si l'utilisateur actuel est le leader
      groupes.push({ nom: groupeNom, nbUtilisateurs, estLeaderActuel });
    });

    const viewModel = {
      groupes,
      user: req.session.user,
      spotifyLinked: req.session.user.spotifyLinked,
      activeDevice: req.session.user.activeDevice ? req.session.user.activeDevice : null,
      currentTrack: req.session.user.currentTrack ? req.session.user.currentTrack : null
    };

    // Passer la liste des groupes avec les informations actualisées au modèle de vue
    res.render('main', viewModel);
  } catch (error) {
    console.error('Erreur lors de la récupération des informations des utilisateurs:', error);
    res.status(500).redirect('/signin');
  }
});


//----------------------------------Routes pour la gestion avec Spotify-----------------------------------
/**
 * @swagger
 * tags:
 *   name: Spotify
 *   description: Gestion de la connexion à Spotify
 */
/**
 * @swagger
 * /loginspotify:
 *   get:
 *     tags:
 *       - Spotify
 *     summary: Initie la connexion à Spotify pour l'utilisateur.
 *     description: Redirige l'utilisateur vers la page d'authentification de Spotify pour obtenir l'autorisation et le token d'accès.
 *     responses:
 *       302:
 *         description: Redirection vers l'authentification Spotify.
 *       401:
 *         description: Utilisateur non connecté, redirection vers /signin.
 */
// Route pour la connexion à Spotify
app.get('/loginspotify', (req, res) => {
  console.log("Entrée dans la route /loginspotify");
  if (req.session.user && req.session.user.username) {
    console.log("Utilisateur connecté :", req.session.user.username);

    // Générer un nouveau stateToken pour cette requête
    const stateToken = uuid.v4();
    console.log("stateToken généré :", stateToken);

    // Stocker le stateToken dans la session de l'utilisateur
    req.session.stateToken = stateToken;

    const scope = 'user-read-private user-read-email ' +
    'user-read-playback-state ' +
    'user-read-currently-playing ' +
    'playlist-modify-public ' +
    'playlist-modify-private ' +
    'playlist-read-private ' +
    'user-library-read ' + // Ajouté pour accéder aux titres likés
    'user-top-read'; // Optionnel, pour accéder aux titres et artistes préférés de l'utilisateur


    const urlAuthSpotify = 'https://accounts.spotify.com/authorize?' + querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECT_URI,
      state: stateToken,
      show_dialog: true
    });

    console.log("Redirection vers l'URL d'authentification Spotify :", urlAuthSpotify);
    res.redirect(urlAuthSpotify);
  } else {
    console.log("Utilisateur non connecté, redirection vers /signin");
    res.redirect('/signin');
  }
});
/**
 * @swagger
 * /callback:
 *   get:
 *     tags:
 *       - Spotify
 *     summary: Callback pour l'authentification Spotify.
 *     description: Gère le callback après l'authentification Spotify, récupère le token d'accès et met à jour la session utilisateur.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Le code fourni par Spotify après l'authentification.
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         description: Le state token pour vérifier la requête.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Callback traité avec succès, utilisateur redirigé vers /main.
 *       403:
 *         description: Mismatch du state token, la requête ne peut pas être vérifiée.
 *       500:
 *         description: Erreur lors de l'obtention du token d'accès.
 */
// Route pour la gestion du callback de Spotify
app.get('/callback', async (req, res) => {
  const { code, state: receivedStateToken } = req.query;

  // Vérifier que le stateToken correspond à celui de la session
  if (!req.session.stateToken || receivedStateToken !== req.session.stateToken) {
    console.error('State token mismatch or missing');
    return res.status(403).send('Request origin cannot be verified');
  }

  // Assurez-vous que l'utilisateur est toujours connecté avant de continuer
  if (!req.session.user) {
    return res.redirect('/signin');
  }
  try {
// Logique pour obtenir le token Spotify.
const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
  grant_type: 'authorization_code',
  code: code,
  redirect_uri: process.env.REDIRECT_URI
}), {
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64')
  }
});

// Mettez à jour la session utilisateur avec les informations Spotify
req.session.user.spotifyLinked = true;
req.session.user.spotifyAccountToken = response.data.access_token;
// Mettre à jour le fichier users.json avec le nouveau token Spotify
const data = await fs.readFile(usersFilePath, 'utf8');
const users = JSON.parse(data);
const userIndex = users.findIndex(user => user.username === req.session.user.username);

if (userIndex !== -1) {
  users[userIndex].spotifyAccountToken = response.data.access_token;
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));

  // Rediriger vers la page principale uniquement si l'utilisateur est trouvé dans le fichier
  res.redirect('/main');
} else {
  console.error('Utilisateur non trouvé dans le fichier lors de la mise à jour du token Spotify.');
  res.status(404).send('Utilisateur non trouvé.');
}


  } catch (error) {
    console.error('Erreur lors de l\'échange du code:', error);
    res.status(500).send('Erreur lors de l\'obtention du token.');
  }
});
/**
 * @swagger
 * /unlinkspotify:
 *   post:
 *     tags:
 *       - Spotify
 *     summary: Déconnecte un utilisateur de son compte Spotify.
 *     description: Cette route permet à un utilisateur de se déconnecter de son compte Spotify et de réinitialiser ses informations Spotify dans l'application.
 *     responses:
 *       200:
 *         description: Déconnexion réussie, redirection vers /main.
 *       401:
 *         description: Utilisateur non authentifié ou problème de session.
 */
// Route pour la déconnexion de l'utilisateur à spotify
app.post('/unlinkspotify', async (req, res) => {
  if (!req.session.user) {
    console.error('Tentative de désassociation sans session utilisateur valide.');
    return res.redirect('/signin');
  }

  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    const users = JSON.parse(data);
    
    const userIndex = users.findIndex(user => user.username === req.session.user.username);

    if (userIndex !== -1) {
      const user = users[userIndex];

      // Réinitialiser les propriétés pour la désassociation
      user.spotifyAccountToken = null;
      user.spotifyLinked = false;
      user.isLeader = false;
      user.spotifyUsername = null;
      user.currentTrack = [];
      user.group = [];

      // Réaffecter le leader si nécessaire
      user.group.forEach(groupName => {
        const groupMembers = users.filter(u => u.group.includes(groupName));
        if (groupMembers.length > 0 && user.isLeader) {
          const newLeaderIndex = groupMembers.findIndex(u => u.username !== user.username);
          if (newLeaderIndex !== -1) {
            groupMembers[newLeaderIndex].isLeader = true; // Assigner un nouveau leader
          }
        }
      });

      await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
      console.log(`Compte Spotify désassocié pour l'utilisateur ${req.session.user.username}.`);

      // Mise à jour de la session utilisateur
      req.session.user = {...req.session.user, spotifyLinked: false, isLeader: false, spotifyUsername: null, currentTrack: [], group: []};

      res.redirect('/main');
    } else {
      console.error('Utilisateur non trouvé dans le fichier lors de la désassociation du compte Spotify.');
      res.status(404).send('Utilisateur non trouvé.');
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fichier des utilisateurs:', error);
    res.status(500).send('Erreur serveur.');
  }
});


//----------------------------------------Routes pour les groupes-----------------------------------------
/**
 * @swagger
 * tags:
 *   name: Groupes
 *   description: Opérations relatives aux groupes d'utilisateurs
 */
/**
 * @swagger
 * /joindreGroupe:
 *   post:
 *     tags:
 *       - Groupes
 *     summary: Rejoint un groupe spécifié par l'utilisateur.
 *     description: >
 *       Permet à l'utilisateur de rejoindre un groupe en spécifiant son nom. 
 *       Si le groupe est déjà rejoint par d'autres, l'utilisateur ne devient pas le leader.
 *       Si l'utilisateur était le leader d'un autre groupe, un nouveau leader est choisi aléatoirement.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nomGroupe:
 *                 type: string
 *                 description: Nom du groupe à rejoindre.
 *                 example: Groupe Rock
 *     responses:
 *       200:
 *         description: L'utilisateur a réussi à rejoindre le groupe.
 *       400:
 *         description: Le nom du groupe n'est pas spécifié ou l'utilisateur n'est pas valide.
 *       404:
 *         description: Aucun utilisateur trouvé ou groupe non existant.
 *       500:
 *         description: Erreur serveur lors de la tentative de rejoindre le groupe.
 */
//Route pour rejoindre un groupe
app.post('/joindreGroupe', async (req, res) => {
  const { nomGroupe } = req.body;
  
  if (!nomGroupe) {
    console.log('Nom du groupe manquant');
    return res.status(400).redirect('/main'); // Utilisez un statut 400 pour indiquer une mauvaise requête
  }

  if (!req.session.user) {
    console.log('Session utilisateur invalide ou expirée');
    return res.redirect('/signin');
  }


  try {
    // Charger les données des utilisateurs depuis le fichier
    const data = await fs.readFile(usersFilePath, 'utf8');
    users = JSON.parse(data);
    
    // Vérifier si des utilisateurs ont été récupérés
    if (!users || !Array.isArray(users)) {
      console.error('Aucun utilisateur trouvé dans le fichier.');
      return res.status(404).send('Aucun utilisateur trouvé.');
    }
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier des utilisateurs:', error);
    return res.status(500).send('Erreur serveur.');
  }



  // Trouver l'index de l'utilisateur dans le tableau des utilisateurs
  const userIndex = users.findIndex(user => user && user.username === req.session.user.username);

  // Vérifier si l'utilisateur a été trouvé
  if (userIndex === -1) {
    console.error('Utilisateur non trouvé lors de la tentative de rejoindre un groupe.');
    return res.status(404).send('Utilisateur non trouvé.');
  }

  // Vérifier si le groupe a déjà été rejoint par d'autres utilisateurs
  const groupJoinedByOthers = users.some(user => user.username !== req.session.user.username && user.group.includes(nomGroupe));

  // Sauvegarder les groupes précédents de l'utilisateur
  const previousGroups = [...users[userIndex].group];

  // Mettre à jour le groupe de l'utilisateur en remplaçant le groupe précédent par le nouveau groupe
  users[userIndex].group = [nomGroupe];

  // Récupérer tous les membres du groupe sauf l'utilisateur actuel
  const otherMembers = users.filter(user => user.username !== req.session.user.username && user.group.includes(nomGroupe));

  // Mettre à jour isLeader en fonction du nombre d'autres membres dans le groupe
  users[userIndex].isLeader = !groupJoinedByOthers;

  // Si l'utilisateur est le leader et il y a d'autres membres dans le groupe, choisir un nouveau leader
  if (groupJoinedByOthers && users[userIndex].isLeader) {
    // Sélectionner un nouveau leader aléatoire parmi les autres membres
    const newLeaderIndex = Math.floor(Math.random() * otherMembers.length);
    // Mettre à jour le nouveau leader
    otherMembers[newLeaderIndex].isLeader = true;
  }

  // Pour chaque ancien groupe de l'utilisateur
  previousGroups.forEach(previousGroup => {
    // Vérifier si l'utilisateur était le leader de ce groupe
    const wasLeaderOfPreviousGroup = users[userIndex].isLeader && previousGroup !== nomGroupe;
    if (wasLeaderOfPreviousGroup) {
      // Si c'est le cas, choisir un nouveau leader parmi les autres membres du groupe
      const membersOfPreviousGroup = users.filter(user => user.group.includes(previousGroup) && user.username !== req.session.user.username);
      if (membersOfPreviousGroup.length > 0) {
        const newLeaderIndex = Math.floor(Math.random() * membersOfPreviousGroup.length);
        membersOfPreviousGroup[newLeaderIndex].isLeader = true;
      }
    }
  });




  try {
    // Écrire les données mises à jour dans le fichier
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fichier des utilisateurs:', error);
    return res.status(500).send('Erreur serveur.');
  }
  
  // Rediriger vers la page principale
  res.redirect('/main');
});
/**
 * @swagger
 * /groupes/{nom}/membres:
 *   get:
 *     tags:
 *       - Groupes
 *     summary: Affiche les membres d'un groupe spécifique.
 *     description: >
 *       Récupère et affiche la liste des membres d'un groupe donné, avec leurs rôles,
 *       noms d'utilisateur Spotify, morceau en cours d'écoute et appareil actif si disponibles.
 *     parameters:
 *       - in: path
 *         name: nom
 *         required: true
 *         schema:
 *           type: string
 *         description: Le nom du groupe à consulter.
 *     responses:
 *       200:
 *         description: Une liste des membres du groupe avec leurs informations.
 *       400:
 *         description: Requête invalide si le nom du groupe n'est pas fourni ou si l'utilisateur n'est pas membre d'un groupe.
 *       401:
 *         description: Non autorisé si l'utilisateur n'est pas connecté.
 *       500:
 *         description: Erreur serveur lors de la récupération des informations des membres du groupe.
 */
// Route pour voir les membres d'un groupe spécifique
app.get('/groupes/:nom/membres', async (req, res) => {
  const nomGroupe = req.params.nom;
  if (!nomGroupe) {
    return res.status(400).send('Le nom du groupe est requis.');
  }

  // Vérifier si req.session.user est défini et contient la propriété username
  if (!req.session.user || !req.session.user.username) {
    console.error('Session utilisateur invalide.');
    return res.status(400).redirect('/signin');
  }

  if (req.session.user.group.length === 0) {
    return res.status(400).send('<br><center>L\'utilisateur ne peut pas accéder à la liste des groupes tant qu\'il n\'appartient pas à un groupe.<br><br>Si vous avez pas encore lié votre compte spotify pensez à le faire<br><br><button onclick="window.location.href=\'/main\'">Retourner au dashboard</button></center>');
  }

  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    const users = JSON.parse(data);

    // Vérifier si l'utilisateur est membre du groupe ou a les autorisations nécessaires pour accéder à cette information
    const membres = users.filter(user => user.group && user.group.includes(nomGroupe));
    
    // Modifier la structure des membres pour inclure uniquement les informations nécessaires
    const membresInfo = membres.map(user => ({
      username: user.username,
      isLeader: user.isLeader,
      spotifyUsername: user.spotifyUsername || 'Non lié',
      currentTrack: user.currentTrack ? `Titre : ${user.currentTrack.title || 'Aucun'} - Artiste(s) : ${user.currentTrack.artist || 'Aucun'} - Album : ${user.currentTrack.album || 'Aucun'}` : 'Aucun morceau en cours d\'écoute',
      activeDevice: user.activeDevice ? `${user.activeDevice.name || 'Aucun'}` : 'Aucun'
    }));

    // Tri des membres par nom d'utilisateur
    membresInfo.sort((a, b) => a.username.localeCompare(b.username));

    // Construction d'une chaîne de caractères pour l'affichage
    let membresString = "<center><br><h2>Liste des membres du groupe " + nomGroupe + ":</h2>";
    membresString += "<button onclick=\"window.location.href='/main'\">Retourner au dashboard</button><br><br>";
    membresInfo.forEach((membre, index) => {
      membresString += `<b><u>Membre ${index + 1}:</b></u> <br><br>`;
      membresString += `Nom d'utilisateur: ${membre.username}<br>-------<br>`;
      membresString += `Rôle: ${membre.isLeader ? 'Chef' : 'Membre'}<br>-------<br>`;
      membresString += `Compte Spotify: ${membre.spotifyUsername}<br>-------<br>`;
      membresString += `Dernier morceau écouté: ${membre.currentTrack || 'Aucun'}<br>-------<br>`;
      // Assurez-vous que membre.activeDevice est un objet avec une propriété `name` avant de l'utiliser, sinon, vérifiez son existence de manière appropriée
      membresString += `Dernier appareil actif: ${membre.activeDevice || 'Aucun'}<br><br>`;
    });

    membresString += '</center>';


  // Envoyer la liste des membres sous forme de chaîne de caractères
  res.send(membresString);
  
  } catch (error) {
    console.error('Erreur lors de la récupération des membres du groupe:', error);
    res.status(500).send('Erreur serveur.');
  }
});



// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
