const express = require('express');
const { addRoutes } = require('./routes.js');
// const Licensing = require('../index.js')



let server, licensing, url, port;

const startServer = (buildPath) => {    
    server = express()
    server.use(express.static(buildPath));
    server.use(express.json());

    // Add routes
    addRoutes(server);

    // Start the server on a random port.
    let app = server.listen(0);
    port = app.address().port;
    url = `http://localhost:${port}/index.html`

    return url
};

const stopServer = () => {    
    if (server) {
        server.close(() => {
          console.log('Server stopped successfully');
        });
      }
};

module.exports = {
	startServer,
	stopServer
}