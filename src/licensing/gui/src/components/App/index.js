// Copyright 2020-2024 The MathWorks, Inc.

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useInterval } from 'react-use';
import './App.css';
import Overlay from '../Overlay';
import LicensingGatherer from '../LicensingGatherer';

import Error from '../Error';
import {
    selectOverlayVisible,
    selectFetchStatusPeriod,
    selectHasFetchedServerStatus,
    selectLicensingProvided,
    selectIsConnectionError,
    selectHasFetchedEnvConfig,
    selectLicensingMhlmHasEntitlements,
    selectIsEntitled,
    selectLicensingInfo,

} from "../../selectors";

import {
    fetchServerStatus,
    fetchEnvConfig,
} from '../../actionCreators';
import EntitlementSelector from "../EntitlementSelector";

function App() {
    const dispatch = useDispatch();

    const overlayVisible = useSelector(selectOverlayVisible);
    const fetchStatusPeriod = useSelector(selectFetchStatusPeriod);
    const hasFetchedServerStatus = useSelector(selectHasFetchedServerStatus);
    const hasFetchedEnvConfig = useSelector(selectHasFetchedEnvConfig);
    const licensingProvided = useSelector(selectLicensingProvided);
    const hasEntitlements = useSelector(selectLicensingMhlmHasEntitlements);
    const isEntitled = useSelector(selectIsEntitled);
    const isConnectionError = useSelector(selectIsConnectionError);
    const licensingInfo = useSelector(selectLicensingInfo);

    
    let dialog;    
    if (isConnectionError) {
        dialog = (
            <Error message="Server unreachable"> </Error>
        );
    }    

    useEffect(() => {
        // Initial fetch environment configuration
        if (!hasFetchedEnvConfig) {
            dispatch(fetchEnvConfig());
        }

    }, [dispatch, hasFetchedEnvConfig]);

    useEffect(() => {
        // Initial fetch server status
        if (hasFetchedEnvConfig && !hasFetchedServerStatus) {
            dispatch(fetchServerStatus());
        }

    }, [dispatch, hasFetchedServerStatus, hasFetchedEnvConfig]);

    // Periodic fetch server status
    useInterval(() => {
        if(hasFetchedServerStatus)
        {
            dispatch(fetchServerStatus());
        }
    }, fetchStatusPeriod);

    let overlayContent;

    if ((!licensingProvided) && hasFetchedServerStatus ) {
        overlayContent = <LicensingGatherer role="licensing" aria-describedby="license-window" />;
    }
    else if (hasEntitlements && !isEntitled) {
        overlayContent = <EntitlementSelector options={licensingInfo.entitlements} />;
    } else {
        overlayContent = <div> <h1>You have successfully signed in. Please feel free to close this window</h1> </div>
    }

    const overlay = overlayVisible ? (
        <Overlay>
            {overlayContent}
        </Overlay>
    ) : null;


    return (
         <React.Fragment>
                <div data-testid="app" className="main">
                    {overlay}
                </div>
        </React.Fragment>
    );
}

export default App;
