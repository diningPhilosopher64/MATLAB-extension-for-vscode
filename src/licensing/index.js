// import { licensingInfo } from './gui/src/reducers/index.js';
const { matlabVersion, supportedVersions} = require('./config.js');
const { fetchAccessToken, fetchExpandToken, fetchEntitlements } = require('./mw.js');
const { writeJSONDataToFile, deleteFile, createDirectoryIfNotExist} = require('./util.js');
const { OnlineLicensingError, EntitlementError } = require('./errors.js');
const path = require('path');
const os = require('os');
const fs = require('fs');

// TODO: Add logger statements for all functions in this class.
class Licensing {
    static instance;
    // TODO: WSEnv should be picked up from environment.
    static wsEnvSuffix = ""
    static mwaApiEndpoint = `https://login${Licensing.wsEnvSuffix}.mathworks.com/authenticationws/service/v4`;
    static mhlmApiEndpoint = `https://licensing${Licensing.wsEnvSuffix}.mathworks.com/mls/service/v1/entitlement/list`

    static mwiConfigFolderPath = path.join(os.homedir(), ".matlab", "MWI", "hosts", os.hostname())
    static mwiConfigFilePath = path.join(Licensing.mwiConfigFolderPath, "proxy_app_config.json")

    constructor() {
        if(Licensing.instance){
            return Licensing.instance;
        }
        
        this.data = {}
        
        // Create the folder for storing proxy_app_config.json file
        this.createCachedConfigDirectory().then(() => {})

        // Initialize licensing
        this.initializeLicensing().then(() => {})        

        this.error = null

        // Update static variable to make this object a singleton instance
        Licensing.instance = this;
    }   

    // TODO: Review this function against its python equivalent
    async initializeLicensing(){
        const useExistingLicense = process.env.MWI_USE_EXISTING_LICENSE
        const nlmConnectionString = process.env.MLM_LICENSE_FILE
        const mwiConfigFileExists = fs.existsSync(Licensing.mwiConfigFilePath)
        
        if (useExistingLicense?.toLowerCase() === "true") {
            this.data = {
                type: "existing_license"
            }
            await this.deleteCachedConfigFile()

        } else if(nlmConnectionString){
            this.data = {
                type: "nlm",
                conn_str: nlmConnectionString,
            }
            await this.deleteCachedConfigFile()

        } else if(mwiConfigFileExists) {
            try {
                const data = JSON.parse(fs.readFileSync(Licensing.mwiConfigFilePath, 'utf8'))
                console.log("Found cached licensing information...")
                const cachedLicensingData = data.licensing
                const cachedMatlabVersion = data.matlab 

                if(!matlabVersion){
                    matlabVersion = cachedMatlabVersion
                }

                if(cachedLicensingData.type === "nlm"){
                    this.data = {
                        "type": "nlm",
                        conn_str: cachedLicensingData.conn_str                     
                    }
                } else if(cachedLicensingData.type === "mhlm") {
                    this.data = {
                        type: "mhlm",
                        identity_token: cachedLicensingData.identity_token,
                        source_id: cachedLicensingData.source_id,
                        expiry: cachedLicensingData.expiry,
                        email_addr: cachedLicensingData.email_addr,
                        first_name: cachedLicensingData.first_name,
                        last_name: cachedLicensingData.last_name,
                        display_name: cachedLicensingData.display_name,
                        user_id: cachedLicensingData.user_id,
                        profile_id: cachedLicensingData.profile_id,
                        entitlements: [],
                        entitlement_id: cachedLicensingData.entitlement_id
                    };

                    const expiryWindow = new Date(this.data.expiry) - 3600000; // subtract 1 hour
                    if (expiryWindow > new Date()) {
                        const successfulUpdate = await this.updateAndPersistLicensing();
                        if (successfulUpdate) {
                            console.debug("Using cached Online Licensing to launch MATLAB.");
                        } else {
                            this.resetAndDeleteCachedConfig();
                        }
                    }

                } else if (licensing.type === "existing_license") {                
                    this.data = cachedLicensingData;
                } else {
                    // Something's wrong, licensing is neither NLM / MHLM / ExistingLicense
                    this.resetAndDeleteCachedConfig();
                }                
            } catch (e) {
                this.__reset_and_delete_cached_config();
            }
        } else {
            console.error("The file does not exist.");
        }
         
    }

    isLicensed() {
        if (this.data?.type) {
            if (this.data.type === "nlm") {
                if (this.data.conn_str) {
                    return true;
                }
            } else if (this.data.type === "mhlm") {
                if (this.data.identity_token && this.data.source_id && this.data.expiry && this.data.entitlement_id) {
                    return true;
                }
            } else if (this.data.type === "existing_license") {
                return true;
            }
        }
        return false;
    }       

    unsetLicensing() {
        this.data = {}
    }


    async setLicensing(licenseData) {
        if(!licenseData.hasOwnProperty('type')){
            throw new Error("Incorrect values supplied!")
        }

        // TODO: Currently, only works for MHLM licensing type.
        const type = licenseData.type

        if (type === 'mhlm') {
            await this.setLicensingToMHLM(licenseData)
        } else if (type == 'nlm') {
            this.setLicensingToNLM(licenseData)
        } else {
            this.setLicensingToExistingLicense(licenseData)
        }
    }

    async setLicensingToMHLM(licenseData) {
        const { token: identityToken, sourceId, emailAddress } = licenseData;
        const expandTokenData  = await fetchExpandToken(Licensing.mwaApiEndpoint + "/tokens", identityToken, sourceId)
        
        if(expandTokenData) {
            this.data = {
                "type": "mhlm",
                "identity_token": identityToken,
                "source_id": sourceId,
                "expiry": expandTokenData["expiry"],
                "email_addr": emailAddress,
                "first_name": expandTokenData["first_name"],
                "last_name": expandTokenData["last_name"],
                "display_name": expandTokenData["display_name"],
                "user_id": expandTokenData["user_id"],
                "profile_id": expandTokenData["profile_id"],
                "entitlements": [],
                "entitlement_id": null,
            }           

            const successfulUpdate = await this.updateAndPersistLicensing()

            if (successfulUpdate){
                console.log("Login successful, persisting login info.")
            }

        } else {
            return;
        }
    }

    setLicensingToNLM() {

    }

    setLicensingToExistingLicense() {

    }

    async updateEntitlements(){
        if (this.data === null || this.data.type !== "mhlm") {
            throw new error("MHLM licensing must be configured to update entitlements!");
        }

        try {
            // Fetch an access token
            const accessTokenData = await fetchAccessToken(
                Licensing.mwaApiEndpoint + "/tokens/access",
                this.data.identity_token,
                this.data.source_id
            );

            // Fetch entitlements
            const entitlements = await fetchEntitlements(
                Licensing.mhlmApiEndpoint,
                accessTokenData.token,
                matlabVersion
            );

            this.data.entitlements = entitlements;

            // Auto-select the entitlement if only one entitlement is returned from MHLM
            if (entitlements.length === 1) {
                this.data.entitlement_id = entitlements[0].id;
            }

            // Successful update
            return true;

        } catch (e) {
            if (e instanceof EntitlementError || e instanceof OnlineLicensingError) {
                this.error = e;
                this.data.identity_token = null;
                this.data.source_id = null;
                this.data.expiry = null;
                this.data.first_name = null;
                this.data.last_name = null;
                this.data.display_name = null;
                this.data.user_id = null;
                this.data.profile_id = null;
                this.data.entitlements = [];
                this.data.entitlement_id = null;
                return true;

            } else {
                this.error = e;
                return false;
            }
        }
    }

    async updateAndPersistLicensing(){
        const successfulUpdate = await this.updateEntitlements();
        if (successfulUpdate) {
            this.persistConfigData();
        } else {
            await this.resetAndDeleteCachedConfig();
        }
        return successfulUpdate;
    }

    async persistConfigData() {
        const dataToWrite = {
            licensing: this.data,
            matlab: {
                version: matlabVersion
            }
        }
        await writeJSONDataToFile(Licensing.mwiConfigFilePath, dataToWrite)
    }

    async resetAndDeleteCachedConfig(){
        this.data = null
        await this.deleteCachedConfigFile()
    }

    async deleteCachedConfigFile() {
        await deleteFile(Licensing.mwiConfigFilePath)
    }

    async createCachedConfigDirectory() {
        await createDirectoryIfNotExist(Licensing.mwiConfigFolderPath);
    }
}

module.exports = Licensing
