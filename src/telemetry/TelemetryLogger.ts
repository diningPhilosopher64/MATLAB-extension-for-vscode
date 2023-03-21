// Copyright 2023 The MathWorks, Inc.

import fetch from 'node-fetch'
import { env, workspace } from 'vscode'

const PRODUCT = 'ML_VS_CODE'
const APPLICATION_NAME = 'DESKTOP_MATLAB' // TODO: Replace with 'MATLAB_EXTENSION_FOR_VSCODE'
const APPLICATION_KEY = 'd8c22ba3-fc0f-4beb-99fc-a109fe9abba9' // TODO: Replace with key for our application - this is the DESKTOP_MATLAB key

const ENDPOINT = 'https://udc-service-integ3.mathworks.com/udc/service/v1/events' // TODO: Replace with production endpoint

export interface TelemetryEvent {
    eventKey: string
    data: unknown
}

export default class TelemetryLogger {
    constructor (private readonly extensionVersion: string) {}

    logEvent (event: TelemetryEvent): void {
        if (this.shouldLogTelemetry()) {
            this.sendEvent(event)
        }
    }

    private shouldLogTelemetry (): boolean {
        const configuration = workspace.getConfiguration('matlab')
        return env.isTelemetryEnabled && (configuration.get<boolean>('telemetry') ?? true)
    }

    private sendEvent (event: TelemetryEvent): void {
        const eventData = {
            logDDUXData: {
                product: PRODUCT,
                keyValues: event.data
            }
        }

        const eventDataString = JSON.stringify(eventData)
        const eventEntry = {
            sessionKey: env.sessionId,
            eventKey: event.eventKey,
            eventDate: this.getCurrentDateString(),
            eventData: eventDataString
        }

        const message = {
            Event: [eventEntry]
        }

        fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mw-udc-client-version': '1.0',
                'x-mw-udc-application-name': APPLICATION_NAME,
                'x-mw-udc-application-version': this.extensionVersion,
                'x-mw-authentication': APPLICATION_KEY
            },
            body: JSON.stringify(message)
        }).then(response => {
            if (!response.ok) {
                console.log(`Warning: Telemetry post failed, code = ${response.status} (${response.statusText})`)
            }
        }).catch(error => {
            console.log('WARNING: Telemetry post error: ', error)
        })
    }

    private getCurrentDateString (): string {
        return new Date().toISOString().slice(0, 23) // Slice off trailing 'Z'
    }
}
