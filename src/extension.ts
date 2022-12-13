import * as path from 'path'
import * as vscode from 'vscode'
import {
    LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'
import NotificationConstants from './NotificationConstants'

let client: LanguageClient

const CONNECTION_STATUS_LABELS = {
    CONNECTED: 'MATLAB: Connected',
    NOT_CONNECTED: 'MATLAB: Not Connected',
    CONNECTING: 'MATLAB: Establishing Connection'
}
const CONNECTION_STATUS_COMMAND = 'matlab.changeMatlabConnection'
let connectionStatusNotification: vscode.StatusBarItem

export async function activate (context: vscode.ExtensionContext): Promise<void> {
    // Set up status bar indicator
    connectionStatusNotification = vscode.window.createStatusBarItem()
    connectionStatusNotification.text = CONNECTION_STATUS_LABELS.NOT_CONNECTED
    connectionStatusNotification.command = CONNECTION_STATUS_COMMAND
    connectionStatusNotification.show()
    context.subscriptions.push(connectionStatusNotification)

    context.subscriptions.push(vscode.commands.registerCommand(CONNECTION_STATUS_COMMAND, () => handleChangeMatlabConnection()))

    // Set up langauge server
    const serverModule: string = context.asAbsolutePath(
        path.join('server', 'out', 'index.js')
    )

    const args = getServerArgs(context)

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
            args
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                // --inspect=6009: runs the server in Node's Inspector mode so VS Code can
                // attach to the server for debugging
                execArgv: ['--nolazy', '--inspect=6009']
            },
            args
        }
    }

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'matlab' }]
    }

    // Create and start the language client
    client = new LanguageClient(
        'matlabls',
        'MATLAB Language Server',
        serverOptions,
        clientOptions
    )

    // Set up notification listeners
    client.onNotification('matlab/connection/update/server', data => handleConnectionStatusChange(data))
    client.onNotification('matlab/launchfailed', () => handleMatlabLaunchFailed())
    client.onNotification('feature/needsmatlab', () => handleFeatureUnavailable())
    client.onNotification('feature/needsmatlab/nomatlab', () => handleFeatureUnavailableWithNoMatlab())

    await client.start()
}

/**
 * Handles user input about whether to connect or disconnect from MATLAB
 */
function handleChangeMatlabConnection (): void {
    void vscode.window.showQuickPick(['Connect to MATLAB', 'Disconnect from MATLAB'], {
        placeHolder: 'Change MATLAB Connection'
    }).then(choice => {
        if (choice == null) {
            return
        }

        if (choice === 'Connect to MATLAB') {
            connectToMatlab()
        } else if (choice === 'Disconnect from MATLAB') {
            disconnectFromMatlab()
        }
    })
}

/**
 * Handles the notifiaction that the connection to MATLAB has changed (either has connected,
 * disconnected, or is in the process of connecting)
 *
 * @param data The notification data
 */
function handleConnectionStatusChange (data: { connectionStatus: string }): void {
    if (data.connectionStatus === 'connected') {
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.CONNECTED
    } else if (data.connectionStatus === 'disconnected') {
        if (connectionStatusNotification.text === CONNECTION_STATUS_LABELS.CONNECTED) {
            const message = NotificationConstants.MATLAB_CLOSED.message
            const options = NotificationConstants.MATLAB_CLOSED.options
            vscode.window.showWarningMessage(message, ...options
            ).then(choice => {
                switch (choice) {
                    case options[0]: // Restart MATLAB
                        connectToMatlab()
                        break
                }
            }, reject => console.error(reject))
        }
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.NOT_CONNECTED
    } else if (data.connectionStatus === 'connecting') {
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.CONNECTING
    }
}

/**
 * Handles the notification that MATLAB failed to launch successfully. This most likely indicates that
 * either MATLAB is not installed or the installPath setting is not configured correctly.
 */
function handleMatlabLaunchFailed (): void {
    const message = NotificationConstants.MATLAB_LAUNCH_FAILED.message
    const options = NotificationConstants.MATLAB_LAUNCH_FAILED.options
    const url = 'https://www.mathworks.com/products/get-matlab.html'

    vscode.window.showErrorMessage(message, ...options).then(choice => {
        switch (choice) {
            case options[0]: // Get MATLAB
                void vscode.env.openExternal(vscode.Uri.parse(url))
                break
            case options[1]: // Open Settings
                void vscode.commands.executeCommand('workbench.action.openSettings', 'matlab.installPath')
                break
        }
    }, reject => console.error(reject))
}

/**
 * Handles the notification that a triggered feature is unavailable without MATLAB running
 */
function handleFeatureUnavailable (): void {
    const message = NotificationConstants.FEATURE_UNAVAILABLE.message
    const options = NotificationConstants.FEATURE_UNAVAILABLE.options

    vscode.window.showErrorMessage(
        message,
        ...options
    ).then(choice => {
        switch (choice) {
            case options[0]: // Start MATLAB
                connectToMatlab()
                break
        }
    }, reject => console.error(reject))
}

/**
 * Handles the notification that a triggered feature is unavailable without MATLAB running,
 * and MATLAB is also unavailable on the system.
 */
function handleFeatureUnavailableWithNoMatlab (): void {
    const message = NotificationConstants.FEATURE_UNAVAILABLE_NO_MATLAB.message
    const options = NotificationConstants.FEATURE_UNAVAILABLE_NO_MATLAB.options
    const url = 'https://www.mathworks.com/products/get-matlab.html'

    vscode.window.showErrorMessage(message, ...options).then(choice => {
        switch (choice) {
            case options[0]: // Get MATLAB
                void vscode.env.openExternal(vscode.Uri.parse(url))
                break
            case options[1]: // Open Settings
                void vscode.commands.executeCommand('workbench.action.openSettings', 'matlab.installPath')
                break
        }
    }, reject => console.error(reject))
}

/**
 * Gets the arguments with which to launch the language server
 *
 * @param context The extension context
 * @returns An array of arguments
 */
function getServerArgs (context: vscode.ExtensionContext): string[] {
    const configuration = vscode.workspace.getConfiguration('matlab')
    const args = [
        `--matlabCertDir=${context.storageUri?.fsPath ?? ''}`,
        `--matlabInstallPath=${configuration.get<string>('installPath') ?? ''}`,
        `--matlabConnectionTiming=${configuration.get<string>('launchMatlab') ?? 'early'}`
    ]

    if (configuration.get<boolean>('indexWorkspace') ?? false) {
        args.push('--indexWorkspace')
    }

    return args
}

/**
 * Sends notification to language server to instruct it to connect to MATLAB
 */
function connectToMatlab (): void {
    void client.sendNotification('matlab/connection/update/client', {
        connectionAction: 'connect'
    })
}

/**
 * Sends notification to language server to instruct it to disconnect from MATLAB
 */
function disconnectFromMatlab (): void {
    void client.sendNotification('matlab/connection/update/client', {
        connectionAction: 'disconnect'
    })
}

// this method is called when your extension is deactivated
export async function deactivate (): Promise<void> {
    await client.stop()
    void client.dispose()
}
