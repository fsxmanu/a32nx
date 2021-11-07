import { Geometry } from '@fmgc/guidance/Geometry';
import { Predictions, StepResults } from '../Predictions';
import { ClimbProfileBuilderResult } from './ClimbProfileBuilderResult';
import { Common, FlapConf } from '../common';
import { FlightPlanManager } from '@fmgc/wtsdk';
import { Fmgc } from '@fmgc/guidance/GuidanceController';
import { EngineModel } from '../EngineModel';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { RFLeg } from '@fmgc/guidance/lnav/legs/RF';

interface VerticalCheckpoint {
    distanceFromEnd: number,
    altitude: number
}

export class ClimbPathBuilder {
    private static TONS_TO_POUNDS = 2240;

    static computeClimbPath(geometry: Geometry, fmgc: Fmgc): ClimbProfileBuilderResult {
        const checkpoints: VerticalCheckpoint[] = [];

        const totalDistance = this.computeTotalFlightPlanDistance(geometry);

        const airfieldElevation = SimVar.GetSimVarValue('L:A32NX_DEPARTURE_ELEVATION', 'feet');
        const accelerationAltitude = SimVar.GetSimVarValue('L:AIRLINER_ACC_ALT', 'number');
        const isaDev = this.isaDeviation();
        const tropoPause = fmgc.getTropoPause() ?? 36089;
        const zeroFuelWeight = fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS;

        const takeoffRollDistance = this.computeTakeOffRollDistance();
        checkpoints.push({
            distanceFromEnd: totalDistance - takeoffRollDistance,
            altitude: airfieldElevation,
        });

        const { distanceTraveled: distanceTraveledSrs } = this.computeTakeoffStepPrediction(isaDev, airfieldElevation, accelerationAltitude, fmgc.getV2Speed(), zeroFuelWeight, fmgc.getFOB() * this.TONS_TO_POUNDS, tropoPause);
        checkpoints.push({
            distanceFromEnd: totalDistance - (takeoffRollDistance + distanceTraveledSrs),
            altitude: accelerationAltitude,
        });

        const cruiseAltitude = SimVar.GetSimVarValue('L:AIRLINER_CRUISE_ALTITUDE', 'number');

        let totalDistanceForClb = 0;
        let fob = fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS;

        for (let altitude = accelerationAltitude; altitude < cruiseAltitude; altitude = Math.min(altitude + 1000, cruiseAltitude)) {
            const climbSpeed = altitude > 10000 ? fmgc.getManagedClimbSpeed() : 250;
            const { distanceTraveled: distanceTraveledSegment, fuelBurned } = this.computeClimbSegmentPrediction(altitude, Math.min(altitude + 1000, cruiseAltitude), isaDev, climbSpeed, zeroFuelWeight, fob, tropoPause);

            totalDistanceForClb += distanceTraveledSegment;
            fob -= fuelBurned;

            checkpoints.push({
                distanceFromEnd: totalDistance - (totalDistanceForClb + takeoffRollDistance + distanceTraveledSrs),
                altitude: Math.min(altitude + 1000, cruiseAltitude)
            })
        }

        this.printAltitudePredictionsAtAltitudes(geometry, checkpoints.sort((a, b) => b.distanceFromEnd - a.distanceFromEnd));

        const distanceToTopOfClimb = takeoffRollDistance + distanceTraveledSrs + totalDistanceForClb;
        const distanceToTopOfClimbFromEnd = totalDistance - distanceToTopOfClimb

        this.printDistanceFromTocToClosestWaypoint(geometry, distanceToTopOfClimbFromEnd)

        return {
            distanceToRotation: takeoffRollDistance,
            distanceToAccelerationAltitude: takeoffRollDistance + distanceTraveledSrs,
            distanceToTopOfClimb,
            distanceToTopOfClimbFromEnd
        }
    }

    private static printAltitudePredictionsAtAltitudes(geometry: Geometry, checkpoints: VerticalCheckpoint[]): number {
        let totalDistanceFromEnd = 0;
        console.log(`checkpoints: ${JSON.stringify(checkpoints)}`);

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistanceFromEnd += leg.distance;

            if (leg instanceof TFLeg || leg instanceof RFLeg) {
                const predictedAltitude = this.interpolateAltitude(totalDistanceFromEnd, checkpoints.map(checkpoint => checkpoint.distanceFromEnd), checkpoints.map(checkpoint => checkpoint.altitude));
                console.log({ totalDistanceFromEnd, "waypoint": leg.from.ident, predictedAltitude })
            } else {
                console.warn(`[FMS/VNAV] Invalid leg when printing flightplan`)
            }
        }

        return totalDistanceFromEnd;
    }

    private static interpolateAltitude(x0: number, x: number[], y: number[]): number {
        if (x0 > x[0]) {
            return y[0]
        }

        for (let index = 0; index < x.length - 1; index++) {
            if (x0 <= x[index] && x0 > x[index + 1]) {
                return y[index] + (x0 - x[index + 1]) * (y[index + 1] - y[index]) / (x[index] - x[index + 1])
            }
        }

        return y[y.length - 1]
    }

    private static computeTakeoffStepPrediction(isaDev: number, starting_altitude: number, accelerationAltitude: number, v2: number, zeroFuelWeight: number, fuelWeight: number, tropoPause: number): StepResults {
        const midwayAltitudeSrs = (accelerationAltitude + starting_altitude) / 2;

        const commandedN1Toga = SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent');

        const machSrs = this.computeMachFromCas(midwayAltitudeSrs, isaDev, v2 + 10);

        return Predictions.altitudeStep(starting_altitude, accelerationAltitude - starting_altitude, v2 + 10, machSrs, commandedN1Toga, zeroFuelWeight, fuelWeight, 0, isaDev, tropoPause, false, FlapConf.CONF_1);
    }

    private static printDistanceFromTocToClosestWaypoint(geometry: Geometry, distanceToTopOfClimbFromEnd: number) {
        for (const [i, leg] of geometry.legs.entries()) {
            distanceToTopOfClimbFromEnd -= leg.distance;

            if (distanceToTopOfClimbFromEnd <= 0) {
                if (leg instanceof TFLeg || leg instanceof RFLeg) {
                    console.log(`[FMS/VNAV] Expected level off: ${-distanceToTopOfClimbFromEnd} nm after ${leg.from.ident}`)
                } else {
                    console.warn(`[FMS/VNAV] Tried computing distance to nearest waypoint, but it's not on a TF/RF leg.`)
                }

                return;
            }
        }
    }

    private static staticAirTemperatureAtAltitude(altitude: number, isaDeviation: number): number {
        return Common.getIsaTemp(altitude) + isaDeviation;
    }

    private static totalAirTemperatureFromMach(altitude: number, mach: number, isaDeviation: number) {
        // From https://en.wikipedia.org/wiki/Total_air_temperature, using gamma = 1.4
        return (this.staticAirTemperatureAtAltitude(altitude, isaDeviation) + 273.15) * (1 + 0.2 * Math.pow(mach, 2)) - 273.15
    }

    private static computeMachFromCas(altitude: number, isaDev: number, speed: number): number {
        const thetaSrs = Common.getTheta(altitude, isaDev);
        const deltaSrs = Common.getDelta(thetaSrs);

        return Common.CAStoMach(speed, deltaSrs);
    }
    private static computeClimbSegmentPrediction(startingAltitude: number, targetAltitude: number, isaDev: number, climbSpeed: number, zeroFuelWeight: number, fob: number, tropoPause: number): StepResults {
        const midwayAltitudeClimb = (startingAltitude + targetAltitude) / 2;

        const machClimb = this.computeMachFromCas(midwayAltitudeClimb, isaDev, climbSpeed);
        const estimatedTat = this.totalAirTemperatureFromMach(midwayAltitudeClimb, machClimb, isaDev)
        const commandedN1Climb = this.getClimbThrustN1Limit(estimatedTat, midwayAltitudeClimb);
        return Predictions.altitudeStep(startingAltitude, targetAltitude - startingAltitude, climbSpeed, machClimb, commandedN1Climb, zeroFuelWeight, fob, 0, isaDev, tropoPause);
    }

    private static computeTotalFlightPlanDistance(geometry: Geometry): number {
        let totalDistance = 0;

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistance += leg.distance
        }

        return totalDistance;
    }

    private static isaDeviation(): number {
        const ambientTemperature = SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "celsius");
        const altitude = SimVar.GetSimVarValue("INDICATED ALTITUDE", "feet");
        return ambientTemperature - Common.getIsaTemp(altitude)
    }

    private static getClimbThrustN1Limit(tat: number, pressureAltitude: number) {
        return EngineModel.tableInterpolation(EngineModel.maxClimbThrustTable1127, tat, pressureAltitude);
    }

    static computeTakeOffRollDistance(): number {
        // TODO
        return 1;
    }
}
