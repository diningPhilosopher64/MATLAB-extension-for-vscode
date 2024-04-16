// import { getEnvConfig, getStatus, setLicensingInfo, fallbackEndpoint } from './routeHandlers.js';
const { getEnvConfig, getStatus, setLicensingInfo, deleteLicensingInfo, fallbackEndpoint } = require('./routeHandlers.js');


const addRoutes = (app) => {
    app.get('/get_env_config', getEnvConfig);
    app.get('/get_status', getStatus);
    app.put('/set_licensing_info', setLicensingInfo);
    app.delete('/set_licensing_info', deleteLicensingInfo);

    // Fallback endpoint for handling requests coming in from react
    // NOTE: Comment out if working with react dev server
    app.get('*', fallbackEndpoint);
};

module.exports = {
    addRoutes
}