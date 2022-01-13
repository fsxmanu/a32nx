class A32NX_StateInitializer {
    init() {
        const active = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool");
        if (active === 1) {
            const autobrakeLevel = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_AUTOBRK_LVL", "Number");
            const autoThrustActive = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_AUTOTHRUST_ACTIVE", "Bool");
            const isManaged = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_USE_MANAGED_SPEED", "Bool");
            const selectedSpeed = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_SPEED", "Number");
            const isApproach = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_IS_APPROACH", "Bool");

            if (autobrakeLevel === 1) {
                SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_LOW_ON_IS_PRESSED", "Number", 1);
            } else if (autobrakeLevel === 2) {
                SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MED_ON_IS_PRESSED", "Number", 1);
            } else if (autobrakeLevel === 3) {
                SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MAX_ON_IS_PRESSED", "Number", 1);
            }

            if (isApproach) {
                SimVar.SetSimVarValue("L:A32NX_FMGC_FLIGHT_PHASE", "Number", 5);
            }

            if (autoThrustActive === 1) {
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 25);
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 25);
                SimVar.SetSimVarValue("K:AUTO_THROTTLE_ARM", "Number", 1);
            }

            if (isManaged) {
                SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PUSH", "Number", 1);
            } else {
                SimVar.SetSimVarValue("L:A320_Neo_FCU_SPEED_SET_DATA", "Number", selectedSpeed);
                SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_SET", "Number", 1);
                SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PULL", "Number", 1);
            }
        }
    }
}
