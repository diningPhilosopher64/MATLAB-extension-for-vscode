import * as path from 'path'
import * as vscode from 'vscode'
import {
    LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'

let client: LanguageClient

const CONNECTION_STATUS_LABELS = {
    CONNECTED: 'MATLAB: Connected',
    NOT_CONNECTED: 'MATLAB: Not Connected',
    CONNECTING: 'MATLAB: Establishing Connection'
}
const CONNECTION_STATUS_COMMAND = 'matlab.changeMatlabConnection'
let connectionStatusNotification: vscode.StatusBarItem

export function activate (context: vscode.ExtensionContext) {
    // Set up status bar indicator
    connectionStatusNotification = vscode.window.createStatusBarItem()
    connectionStatusNotification.text = CONNECTION_STATUS_LABELS.NOT_CONNECTED
    connectionStatusNotification.command = CONNECTION_STATUS_COMMAND
    connectionStatusNotification.show()
    context.subscriptions.push(connectionStatusNotification)

    context.subscriptions.push(vscode.commands.registerCommand(CONNECTION_STATUS_COMMAND, () => handleChangeMatlabConnection()))

    // Set up langauge server
    const serverModule: string = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
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

    const clientDisposable = client.start()
    context.subscriptions.push(clientDisposable)

    client.onReady().then(() => {
        client.onNotification('matlab/connectionStatusChange', data => handleConnectionStatusChange(data))
    })
}

function handleChangeMatlabConnection () {
    vscode.window.showQuickPick(['Connect to MATLAB', 'Disconnect from MATLAB'], {
        placeHolder: 'Change MATLAB Connection'
    }).then(choice => {
        if (!choice) {
            return
        }

        let connectionAction: string = ''
        if (choice === 'Connect to MATLAB') {
            connectionAction = 'connect'
        } else if (choice === 'Disconnect from MATLAB') {
            connectionAction = 'disconnect'
        }

        client.sendNotification('matlab/updateConnection', {
            connectionAction
        })
    })
}

function handleConnectionStatusChange (data: { connectionStatus: string }) {
    if (data.connectionStatus === 'connected') {
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.CONNECTED
    } else if (data.connectionStatus === 'disconnected') {
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.NOT_CONNECTED
    } else if (data.connectionStatus === 'connecting') {
        connectionStatusNotification.text = CONNECTION_STATUS_LABELS.CONNECTING
    }
}

function getServerArgs (context: vscode.ExtensionContext): string[] {
    const configuration = vscode.workspace.getConfiguration('matlab')
    const args = [
        `--matlabCertDir=${context.storageUri?.fsPath}`,
        `--matlabInstallPath=${configuration.get<string>('installPath')}`,
        `--matlabConnectionTiming=${configuration.get<string>('launchMatlab')}`
    ]

    return args
}

// this method is called when your extension is deactivated
export function deactivate () { }
