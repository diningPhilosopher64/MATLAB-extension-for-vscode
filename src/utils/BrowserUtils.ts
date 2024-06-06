// Copyright 2024 The MathWorks, Inc.

import * as vscode from 'vscode'

/**
 * Opens the provided URL in an external browser.
 * If the URL fails to open in the browser, it renders the URL inside a VS Code webview panel.
 * @param {string} url - The URL to open.
 * @returns {Promise<void>} A Promise that resolves when the URL is opened or rendered.
 */
export async function openUrlInExternalBrowser(url: string): Promise<void> {   
    const success = await vscode.env.openExternal(vscode.Uri.parse(url));
    
    // Render inside vscode's webview if the url fails to open in the browser.
    if(!success){
        vscode.window.showWarningMessage('Failed to open licensing server url in browser. Opening it within vs code.')
        const panel = vscode.window.createWebviewPanel('matlabLicensing', 'MATLAB Licensing', vscode.ViewColumn.Active, {enableScripts: true});
       
        panel.webview.html =  `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Webview Example</title>
            <style>
                body, html, iframe {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    border: none;
                }
            </style>
        </head>
        <body>
        <iframe src="${url}"></iframe>
        </body>
        </html>
    `;       
    }
}