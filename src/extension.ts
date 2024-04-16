// Copyright 2022 - 2024 The MathWorks, Inc.

import * as path from 'path'
import * as vscode from 'vscode'
import {
    LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import NotificationConstants from './NotificationConstants'
import TelemetryLogger, { TelemetryEvent } from './telemetry/TelemetryLogger'
import MVM from './commandwindow/MVM'
import { Notifier } from './commandwindow/Utilities'
import TerminalService from './commandwindow/TerminalService'
import Notification from './Notifications'
import ExecutionCommandProvider from './commandwindow/ExecutionCommandProvider'

import {startServer, stopServer} from './licensing/server'
import Licensing = require('./licensing')

let client: LanguageClient

const OPEN_SETTINGS_ACTION = 'workbench.action.openSettings'
const MATLAB_INSTALL_PATH_SETTING = 'matlab.installPath'

export const CONNECTION_STATUS_LABELS = {
    CONNECTED: 'MATLAB: Connected',
    NOT_CONNECTED: 'MATLAB: Not Connected',
    CONNECTING: 'MATLAB: Establishing Connection'
}
const CONNECTION_STATUS_COMMAND = 'matlab.changeMatlabConnection'
export let connectionStatusNotification: vscode.StatusBarItem

export const LICENSING_STATUS_LABELS = {       
    UNLICENSED: 'MATLAB: Not Licensed',
    LICENSED: 'MATLAB: Licensed',
}
const LICENSING_STATUS_COMMAND = 'matlab.licenseMatlab'
export let licensingStatusNotification: vscode.StatusBarItem


let telemetryLogger: TelemetryLogger

let mvm: MVM;
let terminalService: TerminalService;
let executionCommandProvider: ExecutionCommandProvider;

// ASK: Update static folder path. 
// In dev mode of the extension:  __dirname returns  /home/skondapa/work/VSCode_Integrations/matlab-vscode/out instead of ..../matlab-vscode. Is there any other approach
// to get the path to current file correctly ?
// const staticFolderPath: string = path.join(__dirname, "licensing", "gui", "build")  
const staticFolderPath: string = "/home/skondapa/work/VSCode_Integrations/matlab-vscode/src/licensing/gui/build"
let url: string
let licensing = new Licensing()

function openUrlInExternalBrowser(url: string): void {   
    vscode.env.openExternal(vscode.Uri.parse(url));
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
function updateLicensingTextInStatusBar(){
    licensingStatusNotification.text =  licensing.isLicensed() ? LICENSING_STATUS_LABELS.LICENSED : LICENSING_STATUS_LABELS.UNLICENSED
}

export async function activate (context: vscode.ExtensionContext): Promise<void> {
    // Initialize telemetry logger
    telemetryLogger = new TelemetryLogger(context.extension.packageJSON.version)
    telemetryLogger.logEvent({
        eventKey: 'ML_VS_CODE_ENVIRONMENT',
        data: {
            machine_hash: vscode.env.machineId,
            locale: vscode.env.language,
            os_platform: process.platform,
            vs_code_version: vscode.version
        }
    })

    // Set up status bar indicator
    connectionStatusNotification = vscode.window.createStatusBarItem()
    connectionStatusNotification.text = CONNECTION_STATUS_LABELS.NOT_CONNECTED
    connectionStatusNotification.command = CONNECTION_STATUS_COMMAND
    connectionStatusNotification.show()
    context.subscriptions.push(connectionStatusNotification)

    context.subscriptions.push(vscode.commands.registerCommand(CONNECTION_STATUS_COMMAND, () => handleChangeMatlabConnection()))

    // Set up status bar indicator
    // Licensing status
    licensingStatusNotification = vscode.window.createStatusBarItem()
    updateLicensingTextInStatusBar()
    licensingStatusNotification.command = LICENSING_STATUS_COMMAND
    licensingStatusNotification.show()
    context.subscriptions.push(licensingStatusNotification)

    context.subscriptions.push(vscode.commands.registerCommand(LICENSING_STATUS_COMMAND, () => handleChangeLicensing()))



    url = startServer(staticFolderPath);    
	vscode.window.showInformationMessage("Started server successfully at ", url)

    if(!licensing.isLicensed()){
        vscode.window.showInformationMessage("Cached licensing not found! Opening browser");    

        setTimeout(() => {
            // openUrlInWebView(url);
            openUrlInExternalBrowser(url);
        }, 1000);
        
        while(!licensing.isLicensed()){
            await sleep(1000);
            console.log("Sleeping for 1 second till licensing is done...")
        }

        updateLicensingTextInStatusBar()

    } else {
        vscode.window.showInformationMessage("Found cached licensing");    
    }

    

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
                // --inspect=6009: runs the server in Node's Inspector mode so
                // Visual Studio® Code can attach to the server for debugging
                execArgv: ['--nolazy', '--inspect=6009']
            },
            args
        }
    }

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: ['matlab']
    }

    // Create and start the language client
    client = new LanguageClient(
        'matlabls',
        'MATLAB Language Server',
        serverOptions,
        clientOptions
    )

    // Set up notification listeners
    client.onNotification(Notification.MatlabConnectionServerUpdate, (data: { connectionStatus: string }) => handleConnectionStatusChange(data))
    client.onNotification(Notification.MatlabLaunchFailed, () => handleMatlabLaunchFailed())
    client.onNotification(Notification.MatlabFeatureUnavailable, () => handleFeatureUnavailable())
    client.onNotification(Notification.MatlabFeatureUnavailableNoMatlab, () => handleFeatureUnavailableWithNoMatlab())
    client.onNotification(Notification.LogTelemetryData, (data: TelemetryEvent) => handleTelemetryReceived(data))

    mvm = new MVM(client as Notifier);
    terminalService = new TerminalService(client as Notifier, mvm);
    executionCommandProvider = new ExecutionCommandProvider(mvm, terminalService, telemetryLogger);

    context.subscriptions.push(vscode.commands.registerCommand('matlab.runFile', async () => await executionCommandProvider.handleRunFile()))
    context.subscriptions.push(vscode.commands.registerCommand('matlab.runSelection', async () => await executionCommandProvider.handleRunSelection()))
    context.subscriptions.push(vscode.commands.registerCommand('matlab.interrupt', () => executionCommandProvider.handleInterrupt()))
    context.subscriptions.push(vscode.commands.registerCommand('matlab.openCommandWindow', async () => await terminalService.openTerminalOrBringToFront()))
    context.subscriptions.push(vscode.commands.registerCommand('matlab.addToPath', async (uri: vscode.Uri) => await executionCommandProvider.handleAddToPath(uri)))
    context.subscriptions.push(vscode.commands.registerCommand('matlab.changeDirectory', async (uri: vscode.Uri) => await executionCommandProvider.handleChangeDirectory(uri)))

    await client.start()
}

/**
 * Handles user input about whether to connect or disconnect from MATLAB®
 */
function handleChangeMatlabConnection (): void {
    void vscode.window.showQuickPick(['Connect to MATLAB', 'Disconnect from MATLAB'], {
        placeHolder: 'Change MATLAB Connection'
    }).then(choice => {
        if (choice == null) {
            return
        }

        if (choice === 'Connect to MATLAB') {
            sendConnectionActionNotification('connect')
        } else if (choice === 'Disconnect from MATLAB') {
            sendConnectionActionNotification('disconnect')
            terminalService.closeTerminal();
        }
    })
}

function handleChangeLicensing (): void {
    const unLicenseMatlab = "Unset Licensing or change licensing mode"
    const licenseMatlab = "License MATLAB"
    let arr = licensing.isLicensed() ? [unLicenseMatlab] : [licenseMatlab]
    

    void vscode.window.showQuickPick(arr, {
        placeHolder: 'Change MATLAB Licensing'
    }).then(choice => {
        if (choice == null) {
            return
        }

        if (choice === licenseMatlab) {
            openUrlInExternalBrowser(url);

        } else if (choice === unLicenseMatlab) {
            licensing.unsetLicensing()
            openUrlInExternalBrowser(url);
        }

        updateLicensingTextInStatusBar()
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
        terminalService.closeTerminal();
        if (connectionStatusNotification.text === CONNECTION_STATUS_LABELS.CONNECTED) {
            const message = NotificationConstants.MATLAB_CLOSED.message
            const options = NotificationConstants.MATLAB_CLOSED.options
            vscode.window.showWarningMessage(message, ...options
            ).then(choice => {
                if (choice != null) {
                    // Selected to restart MATLAB
                    telemetryLogger.logEvent({
                        eventKey: 'ML_VS_CODE_ACTIONS',
                        data: {
                            action_type: 'restartMATLAB',
                            result: ''
                        }
                    })
                    sendConnectionActionNotification('connect')
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

    terminalService.closeTerminal();
    vscode.window.showErrorMessage(message, ...options).then(choice => {
        switch (choice) {
            case options[0]: // Get MATLAB
                void vscode.env.openExternal(vscode.Uri.parse(url))
                break
            case options[1]: // Open Settings
                void vscode.commands.executeCommand(OPEN_SETTINGS_ACTION, MATLAB_INSTALL_PATH_SETTING)
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

    terminalService.closeTerminal();
    vscode.window.showErrorMessage(
        message,
        ...options
    ).then(choice => {
        if (choice != null) {
            // Selected to start MATLAB
            sendConnectionActionNotification('connect')
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

    terminalService.closeTerminal();
    vscode.window.showErrorMessage(message, ...options).then(choice => {
        switch (choice) {
            case options[0]: // Get MATLAB
                void vscode.env.openExternal(vscode.Uri.parse(url))
                break
            case options[1]: // Open Settings
                void vscode.commands.executeCommand(OPEN_SETTINGS_ACTION, MATLAB_INSTALL_PATH_SETTING)
                break
        }
    }, reject => console.error(reject))
}

function handleTelemetryReceived (event: TelemetryEvent): void {
    event.eventKey = `ML_VS_CODE_${event.eventKey}`
    telemetryLogger.logEvent(event)
}

/**
 * Gets the arguments with which to launch the language server
 *
 * @param context The extension context
 * @returns An array of arguments
 */
function getServerArgs (context: vscode.ExtensionContext): string[] {
    const configuration = vscode.workspace.getConfiguration('MATLAB')
    const args = [
        `--matlabInstallPath=${configuration.get<string>('installPath') ?? ''}`,
        `--matlabConnectionTiming=${configuration.get<string>('launchMatlab') ?? 'onStart'}`
    ]

    if (configuration.get<boolean>('indexWorkspace') ?? false) {
        args.push('--indexWorkspace')
    }

    return args
}

/**
 * Sends notification to language server to instruct it to either connect to or disconnect from MATLAB.
 * @param connectionAction The action - either 'connect' or 'disconnect'
 */
export function sendConnectionActionNotification (connectionAction: 'connect' | 'disconnect'): void {
    void client.sendNotification(Notification.MatlabConnectionClientUpdate, {
        connectionAction
    })
}

// this method is called when your extension is deactivated
export async function deactivate (): Promise<void> {
    stopServer()
    vscode.window.showInformationMessage("Stopped server successfully")
    await client.stop()
    void client.dispose()
}
