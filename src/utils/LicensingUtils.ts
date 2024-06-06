// Copyright 2024 The MathWorks, Inc.

import * as vscode from 'vscode'
import {openUrlInExternalBrowser} from './BrowserUtils'
import Notification from '../Notifications'
import { LanguageClient } from 'vscode-languageclient/node';


let licensingUrl: string 
let licensingStatusBarItem: vscode.StatusBarItem | undefined;
let licensingStatusCommandDisposable: vscode.Disposable | undefined;
let licensingUrlNotificationListener: vscode.Disposable | undefined;
let licensingDataNotificationListener: vscode.Disposable | undefined;
let licensingErrorNotificationListener: vscode.Disposable | undefined;
const LICENSING_STATUS_COMMAND = 'matlab.licenseMatlab'

/**
 * Sets up the licensing status bar item and associated commands in the extension context.
 * 
 * @param {vscode.ExtensionContext} context - The extension context.
 * @param {LanguageClient} client - The language client instance.
 */
export function setupLicensingStatusBarItem(context: vscode.ExtensionContext, client: LanguageClient) : void {  
    if(!licensingStatusBarItem){
        licensingStatusBarItem = vscode.window.createStatusBarItem()
        licensingStatusBarItem.command = LICENSING_STATUS_COMMAND
        licensingStatusBarItem.show()
        
        licensingStatusCommandDisposable = vscode.commands.registerCommand(LICENSING_STATUS_COMMAND, () => handleChangeLicensing(client))
        
        context.subscriptions.push(licensingStatusBarItem)
        context.subscriptions.push(licensingStatusCommandDisposable)

    }    
}

/**
 * Removes the licensing status bar item and associated commands.
 */
export function removeLicensingStatusBarItem() : void {     
    if(licensingStatusBarItem){
        licensingStatusBarItem.dispose();
        licensingStatusBarItem = undefined;  
    }

    if (licensingStatusCommandDisposable) {
        licensingStatusCommandDisposable.dispose();
        licensingStatusCommandDisposable = undefined;  
    }
}

/**
 * Sets up the licensing notification listeners for the extension.
 * 
 * @param {LanguageClient} client - The language client instance.
 */
export function setupLicensingListeners(client: LanguageClient) : void {
    if(!licensingUrlNotificationListener){
        licensingUrlNotificationListener = client.onNotification(Notification.LicensingServerUrl, (url: string) =>  {licensingUrl=url;  openUrlInExternalBrowser(url)})
    }

    if(!licensingDataNotificationListener){
        licensingDataNotificationListener = client.onNotification(Notification.LicensingData, (data: string) => handleChangeLicensingData(data))
    }

    if(!licensingErrorNotificationListener){
        licensingErrorNotificationListener = client.onNotification(Notification.LicensingError, (data: string) => handleLicensingError(data))
    }

}

/**
 * Removes the licensing notification listeners for the extension.
 */
export function removeLicensingListeners() : void  {
    if(licensingUrlNotificationListener){
        licensingUrlNotificationListener.dispose();
        licensingUrlNotificationListener = undefined;
    }

    if(licensingDataNotificationListener) {
        licensingDataNotificationListener.dispose();
        licensingDataNotificationListener = undefined;  
    }

    if(licensingErrorNotificationListener) {
        licensingErrorNotificationListener.dispose();
        licensingErrorNotificationListener = undefined;  
    }
}

/**
 * Handles the licensing change or delete actions based on the user's choice.
 * 
 * @param {LanguageClient} client - The language client instance.
 */
function handleChangeLicensing (client: LanguageClient): void {
    void vscode.window.showQuickPick(['Change MATLAB Licensing', 'Delete MATLAB Licensing'], {
        placeHolder: 'Change MATLAB Licensing'
    }).then(choice => {
        if (choice == null) {
            return
        }

        if (choice === 'Change MATLAB Licensing') {
            void client.sendNotification(Notification.LicensingDelete)
            openUrlInExternalBrowser(licensingUrl);            
        } else if (choice === 'Delete MATLAB Licensing') {            
            void client.sendNotification(Notification.LicensingDelete)
        }
    })
}

/**
 * Handles the licensing error notification by displaying an information message.
 * 
 * @param {string} data - The error message data.
 */
function handleLicensingError(data: string): void {
    vscode.window.showInformationMessage(`Licensing failed with error: ${data}`)
}

/**
 * Handles the licensing data notification by updating the licensing status bar item.
 * 
 * @param {string} data - The licensing data.
 */
function handleChangeLicensingData(data: string) : void {
    if (licensingStatusBarItem){   
        licensingStatusBarItem.text = data; 
        licensingStatusBarItem.show()
    }    
}