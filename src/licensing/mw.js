// import xml2js from 'xml2js';
// import { sendRequest, findAllByKey } from "./util.js";

const xml2js = require('xml2js');
const { sendRequest, findAllByKey } = require('./util.js');

async function fetchExpandToken(mwaUrl, identityToken, sourceId){
    let data  =  {
            "tokenString": identityToken,
            "tokenPolicyName": "R2",
            "sourceId": sourceId,
        }

    const formData = new URLSearchParams(data).toString();

    const options = {
        "method":  "POST", 
        "headers": {
            "content-type":  "application/x-www-form-urlencoded", 
            "accept": "application/json",
            "X_MW_WS_callerId": "desktop-jupyter"
        },
        "body": formData
    }

    const response =  await sendRequest(mwaUrl, options)
    const jsonData = await response.json()

    return {
        "expiry": jsonData["expirationDate"],
        "first_name": jsonData["referenceDetail"]["firstName"],
        "last_name": jsonData["referenceDetail"]["lastName"],
        "display_name": jsonData["referenceDetail"]["displayName"],
        "user_id": jsonData["referenceDetail"]["userId"],
        "profile_id": jsonData["referenceDetail"]["referenceId"],
    }
}


async function fetchAccessToken(accessTokenUrl, identityToken, sourceId){
    let data  =  {
            "tokenString": identityToken,
            "type": "MWAS",
            "sourceId": sourceId,
        }

    const formData = new URLSearchParams(data).toString();

    const options = {
        "method":  "POST", 
        "headers": {
            "content-type":  "application/x-www-form-urlencoded", 
            "accept": "application/json",
            "X_MW_WS_callerId": "desktop-jupyter"
        },
        "body": formData
    }

    const response = await sendRequest(accessTokenUrl, options)
    const jsonData = await response.json()

    return {
        "token": jsonData["accessTokenString"],
    }
}

async function fetchEntitlements(mhlmUrl, accessToken, matlabVersion) {
    const data = {
        "token": accessToken,
        "release": matlabVersion,
        "coreProduct": "ML",
        "context": "jupyter",
        "excludeExpired": "true",
    }
    const formData = new URLSearchParams(data).toString();
    const options = {
        "method":  "POST", 
        "headers": {
            "content-type":  "application/x-www-form-urlencoded", 
        },
        "body": formData
    }

    const response = await sendRequest(mhlmUrl, options);
    const text = await response.text()
   
    const jsonData = await xml2js.parseStringPromise(text)
    if (!jsonData["describe_entitlements_response"].hasOwnProperty("entitlements")){
        return null;
    }
    let entitlements = findAllByKey(jsonData["describe_entitlements_response"]["entitlements"], "entitlement")

    entitlements = entitlements.map(entitlement => {
        entitlement = entitlement[0]
        return {
            id: String(entitlement["id"]),
            label: String(entitlement["label"]),
            license_number: String(entitlement["license_number"])
        }
    }) 

    return entitlements;
}


module.exports = {
    fetchAccessToken,
    fetchEntitlements,
    fetchExpandToken
}