class AppError extends Error {
    /**
     * A Generic Parent class which inherits the Error class.
     * This class will be inherited by other classes representing specific exceptions.
     * 
     * @param {string} message - Error message.
     * @param {string|null} logs - Logs associated with the error.
     * @param {string|null} stacktrace - Stacktrace associated with the error.
     */
    constructor(message, logs = null, stacktrace = null) {
        super(message);
        this.name = this.constructor.name;
        this.logs = logs;
        this.stacktrace = stacktrace;
    }
}

class LicensingError extends AppError {
    /**
     * A Class which inherits the AppError class.
     * This class represents any Licensing Errors (MHLM and NLM Licensing)
     */
    constructor(message, logs = null, stacktrace = null) {
        super(message, logs, stacktrace);
    }
}

class OnlineLicensingError extends LicensingError {
    /**
     * A Class which inherits the Licensing class.
     * This class represents any errors specific to MHLM Licensing.
     */
    constructor(message, logs = null, stacktrace = null) {
        super(message, logs, stacktrace);
    }
}

class EntitlementError extends OnlineLicensingError {
    /**
     * A Class which inherits the OnlineLicensingError class.
     * This class represents errors with Entitlements in MHLM Licensing.
     */
    constructor(message, logs = null, stacktrace = null) {
        super(message, logs, stacktrace);
    }
}

module.exports = {
    AppError, 
    LicensingError,
    OnlineLicensingError,
    EntitlementError
}