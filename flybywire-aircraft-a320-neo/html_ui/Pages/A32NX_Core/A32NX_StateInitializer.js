class A32NX_StateInitializer {
    constructor() {
        this.autobrakeLevel = null;
        this.isManaged = null;
        this.selectedSpeed = null;
    }

    init() {
        this.autobrakeLevel = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_AUTOBRK_LVL", "Number");
        this.isManaged = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_USE_MANAGED_SPEED", "Bool");
        this.selectedSpeed = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_SPEED", "Number");
    }

    update() {
        const active = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool");
        console.log("HEREEEE: active=", active);
        if (active === 1) {
            const athr = SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_STATUS", "Number");

            if (athr === 0) {
                if (this.autobrakeLevel === 1) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_LOW_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_LOW_ON_IS_PRESSED", "Number", 0);
                    });
                } else if (this.autobrakeLevel === 2) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MED_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MED_ON_IS_PRESSED", "Number", 0);
                    });
                } else if (this.autobrakeLevel === 3) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MAX_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MAX_ON_IS_PRESSED", "Number", 0);
                    });
                }
                if (this.isManaged) {
                    SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PUSH", "Number", 1);
                } else {
                    SimVar.SetSimVarValue("L:A320_Neo_FCU_SPEED_SET_DATA", "Number", this.selectedSpeed).then(() => {
                        SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_SET", "Number", 1).then(() => {
                            SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PULL", "Number", 1);
                        });
                    });
                }
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 45);
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:2", "Number", 45);
            } else if (athr === 1) {
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 25);
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:2", "Number", 25);
            } else {
                SimVar.SetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool", 0);
            }
        }
    }
}
