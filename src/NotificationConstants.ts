// TODO: Move strings to resources file (prep for l10n)
export default {
    MATLAB_CLOSED: {
        message: 'MATLAB has been closed. Some functionality might be unavailable.',
        options: ['Restart MATLAB']
    },
    MATLAB_LAUNCH_FAILED: {
        message: 'MATLAB failed to launch. If MATLAB is installed, confirm that the MATLAB executable path setting is properly configured.',
        options: ['Get MATLAB', 'Open Settings']
    },
    FEATURE_UNAVAILABLE: {
        message: 'This feature is not available without MATLAB running.',
        options: ['Start MATLAB']
    },
    FEATURE_UNAVAILABLE_NO_MATLAB: {
        message: 'This feature is not available without MATLAB installed. If MATLAB is installed, confirm that the MATLAB executable path setting is properly configured.',
        options: ['Get MATLAB', 'Open Settings']
    }
}
