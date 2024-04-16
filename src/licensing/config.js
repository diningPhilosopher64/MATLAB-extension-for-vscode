// import os from 'os';
// import path from 'path';

const os = require('os');
const path = require('path');

// ASK: Will the matlabVersion always be available ?
// will the extension ensure that it knows the version on PATH ? 
// If so:
// 1) both matlabVersion and supportedVersions can be removed
// 2) All the corresponding references in the frontend code can be removed
// 3) env_config endpoint can be removed.

// TODO: Need to pick up matlab version from matlab on path. Should convert this 
// to a function which checks matlab executable on PATH.
// If not found ask info from the user ? (will require further frontend changes) or Error out using 
// VSCode's pop up notification.
const matlabVersion = "R2023a"

// TODO: Pick up supported matlab versions from environment. Should convert this to a function
// which reads from the environment the paths to available MATLABs and then allow user to pick one 
// if there are multiple ?
const supportedVersions = ["R2023a", "R2023b"]


let port = null 
let url = null;

module.exports = {
    port,
    url,
    supportedVersions,
    matlabVersion
}
