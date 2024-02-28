const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YSpotify API',
      version: '1.0.0',
      description: 'YSpotify API est un service d\'extension pour l\'API Spotify conçu pour les étudiants d\'Aix Ynov Campus. Cette API offre des fonctionnalités supplémentaires pour interagir avec les données Spotify de manière plus sociale et collaborative.',
      contact: {
        name: 'Enzo',
        email: 'enzo.chamanier@ynov.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./server.js'], // Emplacement de vos fichiers de routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
