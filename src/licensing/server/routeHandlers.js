const { matlabVersion, supportedVersions } = require('../config.js');
const  Licensing = require('../index.js');
const { marshalLicensingInfo } = require('../util.js')

const path = require('path');
let licensing = new Licensing();

const getEnvConfig = (req, res) => {
res.send({"matlab":{"version": matlabVersion, "supportedVersions": supportedVersions}})
};

const getStatus = (req, res) => {    
    const status = {
        "matlab": {
            "version": matlabVersion,
        },
        
        "licensing": marshalLicensingInfo(licensing.data),
        "error": null,
        "warnings": [],
        "wsEnv": Licensing.wsEnvSuffix
    }

  return res.send(status)
};

const setLicensingInfo = async (req, res) => {    
    const jsonData = req.body
    await licensing.setLicensing(jsonData)

    const status = {
        "matlab": {
        "version": matlabVersion
        },
        "wsEnv": Licensing.wsEnvSuffix,
        "error": null, 
        "warnings": [],
        "licensing": marshalLicensingInfo(licensing.data)
    }

    return res.send(status)
};

// TODO: Add unsetLicensingInfo endpoint ?

const fallbackEndpoint = (req, res) => {
    res.sendFile(path.join(__dirname + '/build/index.html'));
};


module.exports = {
    getEnvConfig,
    getStatus,
    setLicensingInfo,
    fallbackEndpoint
}

