// import {promises as fs} from 'fs';
const fs = require('fs').promises;
const { mwiConfigFilePath, licensing } = require('./config.js');


async function createDirectoryIfNotExist(directoryPath) {
    try {
        await fs.mkdir(directoryPath, { recursive: true });
        console.log(`Directory created or already exists: ${directoryPath}`);
    } catch (error) {
        console.error(`Error creating directory: ${error.message}`);
    }
}

async function writeJSONDataToFile(filePath, data) {
    try {
        const dataString = JSON.stringify(data, null, 4); 
        await fs.writeFile(filePath, dataString, 'utf8');
        console.log(`File written successfully to ${filePath}`);
    } catch (error) {
        console.error(`Error writing file: ${error.message}`);
    }
}

async function deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`File at path: ${filePath} deleted successfully`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`File at path ${filePath} does not exist`);
            } else {
                console.error('Error deleting file:', err);
            }
    }
  }

async function sendRequest(url, options) {
    try{
        const response = await fetch(url, options)
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        return response;
 
    } catch (error) {
        console.log("\n Failed with ", error)
        return null;
    }
}

function findAllByKey(obj, keyToFind) {
    let result = [];

    function recursiveSearch(obj) {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (obj.hasOwnProperty(keyToFind)) {
            result.push(obj[keyToFind]);
        }

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                recursiveSearch(obj[key]);
            }
        }
    }

    recursiveSearch(obj);
    return result;
}

function marshalLicensingInfo(data){
    const type = data.type
    if(type == "mhlm") {
        return {
            "type": "mhlm",
            "emailAddress": data["email_addr"],
            "entitlements": data["entitlements"],
            "entitlementId": data["entitlement_id"]
        }

    } else if(type == "nlm") {
        return {
            "type": "nlm",
            "connectionString": data["conn_str"],
        }

    } else if(type == "existing_license") {
        return {"type": "existing_license"}
    }
}

module.exports  = {
    createDirectoryIfNotExist,
    writeJSONDataToFile,
    deleteFile,
    sendRequest,
    findAllByKey,
    marshalLicensingInfo
}
