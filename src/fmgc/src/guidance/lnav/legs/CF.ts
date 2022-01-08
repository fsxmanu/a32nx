import { AltitudeConstraint, SpeedConstraint } from '@fmgc/guidance/lnav/legs/index';
import { Coordinates } from '@fmgc/flightplanning/data/geo';
import { Guidable } from '@fmgc/guidance/Guidable';
import { SegmentType } from '@fmgc/flightplanning/FlightPlanSegment';
import { GuidanceParameters } from '@fmgc/guidance/ControlLaws';
import { courseToFixDistanceToGo, courseToFixGuidance } from '@fmgc/guidance/lnav/CommonGeometry';
import { XFLeg } from '@fmgc/guidance/lnav/legs/XF';
import { LnavConfig } from '@fmgc/guidance/LnavConfig';
import { Transition } from '@fmgc/guidance/lnav/Transition';
import { Geo } from '@fmgc/utils/Geo';
import { PathVector, PathVectorType } from '../PathVector';

export class CFLeg extends XFLeg {
    private computedPath: PathVector[] = [];

    constructor(
        fix: WayPoint,
        public readonly course: DegreesTrue,
        segment: SegmentType,
    ) {
        super(fix);

        this.segment = segment;
    }

    getPathStartPoint(): Coordinates | undefined {
        if (this.inboundGuidable instanceof Transition && this.inboundGuidable.isComputed) {
            return this.inboundGuidable.getPathEndPoint();
        }

        // Estimate where we should start the leg
        return this.estimateStartWithoutInboundTransition();
    }

    /**
     * Based on FBW-22-07
     *
     * @private
     */
    private estimateStartWithoutInboundTransition(): Coordinates {
        const inverseCourse = Avionics.Utils.clampAngle(this.course + 180);

        if (this.inboundGuidable) {
            const prevLegTerm = this.inboundGuidable.getPathEndPoint();

            return Geo.doublePlaceBearingIntercept(
                this.getPathEndPoint(),
                prevLegTerm,
                inverseCourse,
                Avionics.Utils.clampAngle(inverseCourse + 90),
            );
        }

        return Avionics.Utils.bearingDistanceToCoordinates(
            inverseCourse,
            1,
            this.fix.infos.coordinates.lat,
            this.fix.infos.coordinates.long,
        );
    }

    get predictedPath(): PathVector[] {
        return this.computedPath;
    }

    recomputeWithParameters(isActive: boolean, _tas: Knots, _gs: Knots, ppos: Coordinates, _trueTrack: DegreesTrue, previousGuidable: Guidable, nextGuidable: Guidable) {
        this.inboundGuidable = previousGuidable;
        this.outboundGuidable = nextGuidable;

        this.computedPath = [{
            type: PathVectorType.Line,
            startPoint: this.getPathStartPoint(),
            endPoint: this.getPathEndPoint(),
        }];

        this.isComputed = true;

        if (LnavConfig.DEBUG_PREDICTED_PATH) {
            this.computedPath.push(
                {
                    type: PathVectorType.DebugPoint,
                    startPoint: this.getPathStartPoint(),
                    annotation: 'CF START',
                },
                {
                    type: PathVectorType.DebugPoint,
                    startPoint: this.getPathEndPoint(),
                    annotation: 'CF END',
                },
            );
        }
    }

    get altitudeConstraint(): AltitudeConstraint | undefined {
        return undefined;
    }

    get inboundCourse(): Degrees {
        return this.course;
    }

    get outboundCourse(): Degrees {
        return this.course;
    }

    getDistanceToGo(ppos: Coordinates): NauticalMiles {
        return courseToFixDistanceToGo(ppos, this.course, this.getPathEndPoint());
    }

    getGuidanceParameters(ppos: Coordinates, trueTrack: Degrees): GuidanceParameters | undefined {
        return courseToFixGuidance(ppos, trueTrack, this.course, this.getPathEndPoint());
    }

    getNominalRollAngle(_gs: Knots): Degrees {
        return 0;
    }

    isAbeam(ppos: Coordinates): boolean {
        const dtg = courseToFixDistanceToGo(ppos, this.course, this.getPathEndPoint());

        return dtg >= 0 && dtg <= this.distance;
    }

    get speedConstraint(): SpeedConstraint | undefined {
        return undefined;
    }

    get repr(): string {
        return `CF(${this.course.toFixed(1)}°) TO ${this.fix.ident}`;
    }
}