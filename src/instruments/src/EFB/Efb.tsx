import React, { useEffect, useState } from 'react';

import { UIMessagesProvider, useUIMessages } from './UIMessages/Provider';

import { Redirect, Route, Switch } from 'react-router-dom';
import { useSimVar } from '@instruments/common/simVars';
import { useInteractionEvent } from '@instruments/common/hooks';
import { usePersistentNumberProperty } from '../Common/persistence';
import NavigraphClient, { NavigraphContext } from './ChartsApi/Navigraph';

import { StatusBar } from './StatusBar/StatusBar';
import { ToolBar } from './ToolBar/ToolBar';

import { Dashboard } from './Dashboard/Dashboard';
import { Dispatch } from './Dispatch/Dispatch';
import { Ground } from './Ground/Ground';
import { Performance } from './Performance/Performance';
import { Navigation } from './Navigation/Navigation';
import { ATC } from './ATC/ATC';
import { Settings } from './Settings/Settings';
import { Failures } from './Failures/Failures';

import { clearEfbState, useAppDispatch } from './Store/store';
import logo from './Assets/fbw-logo.svg';

import { NotificationsContainer } from './UIMessages/Notification';

const navigraph = new NavigraphClient();

const ApplicationNotifications = () => {
    const firstNotification = useUIMessages().notifications[0];

    return (
        <NotificationsContainer>
            {firstNotification}
        </NotificationsContainer>
    );
};

const ScreenLoading = () => (
    <div className="loading-screen">
        <div className="center">
            <div className="placeholder">
                <img src={logo} className="fbw-logo" alt="logo" />
            </div>
            <div className="loading-bar">
                <div className="loaded" />
            </div>
        </div>
    </div>
);

export enum PowerState {
    OFF,
    LOADING,
    LOADED,
}

interface PowerContextInterface {
    powerState: PowerState,
    setPowerState: (PowerState) => void
}

export const PowerContext = React.createContext<PowerContextInterface>(undefined as any);
export const usePower = () => React.useContext(PowerContext);

const Efb = () => {
    const [powerState, setPowerState] = useState<PowerState>(PowerState.LOADED);

    const [currentLocalTime] = useSimVar('E:LOCAL TIME', 'seconds', 3000);
    const [, setBrightness] = useSimVar('L:A32NX_EFB_BRIGHTNESS', 'number');
    const [brightnessSetting] = usePersistentNumberProperty('EFB_BRIGHTNESS', 0);
    const [usingAutobrightness] = useSimVar('L:A32NX_EFB_USING_AUTOBRIGHTNESS', 'bool', 300);
    const [dayOfYear] = useSimVar('E:ZULU DAY OF YEAR', 'number');
    const [latitude] = useSimVar("PLANE LATITUDE", 'degree latitude');

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (powerState === PowerState.OFF) {
            dispatch(clearEfbState());
        }
    }, [powerState]);

    function offToLoaded() {
        setPowerState(PowerState.LOADING);
        setTimeout(() => {
            setPowerState(PowerState.LOADED);
        }, 100);
    }

    useInteractionEvent('A32NX_EFB_POWER', () => {
        if (powerState === PowerState.OFF) {
            offToLoaded();
        } else {
            setPowerState(PowerState.OFF);
        }
    });

    function calculateBrightness (latitude: number, dayOfYear: number, timeOfDay: number)  {
        const solarTime = timeOfDay + (dayOfYear - 1) * 24;
        const solarDeclination = 0.409 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
        const solarAltitude = Math.asin(Math.sin(latitude * Math.PI / 180) * Math.sin(solarDeclination) + Math.cos(latitude * Math.PI / 180) * Math.cos(solarDeclination) * Math.cos(2 * Math.PI * solarTime / 24));
        const solarZenith = 90 - (latitude - solarDeclination);

        return Math.min(Math.max((-solarAltitude * (180 / Math.PI)) / solarZenith * 100, 0), 100);
    };

    // handle setting brightness if user is using autobrightness
    useEffect(() => {
        if (usingAutobrightness) {
            const localTime = currentLocalTime / 3600;
            setBrightness((calculateBrightness(latitude, dayOfYear, localTime)));
        } else {
            setBrightness(brightnessSetting);
        }
    }, [currentLocalTime, usingAutobrightness]);

    switch (powerState) {
    case PowerState.OFF:
        return <div className="w-screen h-screen" onClick={() => offToLoaded()} />;
    case PowerState.LOADING:
        return <ScreenLoading />;
    case PowerState.LOADED:
        return (
                <NavigraphContext.Provider value={navigraph}>
                    <PowerContext.Provider value={{ powerState, setPowerState }}>
                        <UIMessagesProvider>
                        <div className="bg-navy-regular">
                            <ApplicationNotifications />
                            <StatusBar />
                            <div className="flex flex-row">
                                <ToolBar />
                                <div className="pt-14 pr-6 w-screen h-screen text-gray-700">
                                    <Switch>
                                        <Route exact path="/">
                                            <Redirect to="/dashboard" />
                                        </Route>
                                        <Route path="/dashboard">
                                            <Dashboard />
                                        </Route>
                                        <Route path="/dispatch">
                                            <Dispatch />
                                        </Route>
                                        <Route path="/ground">
                                            <Ground />
                                        </Route>
                                        <Route path="/performance">
                                            <Performance />
                                        </Route>
                                        <Route path="/navigation">
                                            <Navigation />
                                        </Route>
                                        <Route path="/atc">
                                            <ATC />
                                        </Route>
                                        <Route path="/failures">
                                            <Failures />
                                        </Route>
                                        <Route path="/settings">
                                            <Settings />
                                        </Route>
                                    </Switch>
                                </div>
                            </div>
                        </div>
                        </UIMessagesProvider>
                    </PowerContext.Provider>
                </NavigraphContext.Provider>
        );
    default:
        throw new Error('Invalid content state provided');
    }
};

export default Efb;
