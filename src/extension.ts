import * as path from 'path'
import * as vscode from 'vscode'
import {
    LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'

let client: LanguageClient

export function activate (context: vscode.ExtensionContext) {
    const serverModule: string = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    )

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
            args: []
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                // --inspect=6009: runs the server in Node's Inspector mode so VS Code can
                // attach to the server for debugging
                execArgv: ['--nolazy', '--inspect=6009']
            },
            args: []
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
}

// this method is called when your extension is deactivated
export function deactivate () { }
