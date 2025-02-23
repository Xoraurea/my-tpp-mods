/* Party Shifts Mod - party-shifts/main.js
   The main body of the Party Shifts mod to be loaded first by Executive. */

{
    const mod = {};

    const minShift = 0.5; const maxShift = 2.5;

    const boxMullerRand = () => {
        /* Borrowed from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve. */
        let u = 0, v = 0;

        while(u === 0) u = Math.random(); /* Converting [0,1) to (0,1). */
        while(v === 0) v = Math.random();

        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        num = num / 10.0 + 0.5; /* Translate to 0 -> 1. */

        if (num > 1 || num < 0) return boxMullerRand(); /* Resample for results not between 0 and 1. */
        return num;
    };

    const beginShiftCalcs = () => {
        let stateScores = [];

        let maxDelta = 0;
        let minDelta = 1000000;

        /* We iterate through every state using the provided API. */
        Executive.data.states.allStates.forEach(state => {
            /* We now calculate an effective score for Democrats and Republicans. */
            let effectiveDemScore = 0; let demPolCount = 0;
            let effectiveRepScore = 0; let repPolCount = 0;

            const demPolicyFactors = state.demVoteFactors.filter(factor => factor.type === "policy");
            const repPolicyFactors = state.repVoteFactors.filter(factor => factor.type === "policy");

            /* Get the object for the current state with the support history of each policy. */
            const poliHist = policyHistory.filter(histObj => histObj.id === state.name)[0];

            const statePoliticians = Executive.data.politicians.getStatePoliticians(state, true);

            statePoliticians.forEach(politician => {
                const job = politician.jobs.job1.id;
                let weight = 1;

                if(job !== "usSenate" || job !== "governor"){
                    weight /= 2;
                    if(job !== "usHouse") weight /= 10;
                }

                let polScore = (politician.extendedAttribs.appr.d.b + politician.extendedAttribs.appr.r.b) / 2;

                const prefix = (politician.caucusParty === "Democrat") ? "dem" : "rep";

                if(prefix === "dem"){
                    effectiveDemScore += (polScore * weight);
                    demPolCount += weight;
                } else {
                    effectiveRepScore += (polScore * weight);
                    repPolCount += weight;
                }
            });

            /* If a state has no elected officials from a party, no shifts will happen. */
            if(demPolCount === 0 || repPolCount === 0){}
            else {
                effectiveDemScore /= demPolCount;
                effectiveRepScore /= repPolCount;

                const demRepDelta = effectiveDemScore - effectiveRepScore;

                const absDelta = Math.abs(demRepDelta);
                if(absDelta < minDelta) minDelta = absDelta;
                if(absDelta > maxDelta) maxDelta = absDelta;

                stateScores.push({
                    stateId: state.id,
                    demRepDelta,
                    absDelta
                });
            };
        });

        /* Finally, we do the shift! */
        stateScores.forEach(scoreObj => {
            const swingAmount = (((maxShift - minShift) * boxMullerRand()) + minShift) / 100;

            /* To make this work, we'll create a dummy game event and execute that event. */
            const dummyEvent = {
                district: "state",
                districtID: scoreObj.stateId,
                effectOccur: "always",
                effectType: "single",
                fromParty: (scoreObj.demRepDelta >= 0) ? "R" : "D",
                toParty: (scoreObj.demRepDelta >= 0) ? "D" : "R",
                type: "upPartyDem",
                value: swingAmount
            };

            runEventEffects(dummyEvent, []);
        });
    };

    mod.init = () => {
        /* Our updates to party ID statistics will be done after every game turn. */
        Executive.functions.registerPostHook("runNextTurn", () => {
            if(weekNum === 51) beginShiftCalcs();
        });
    };

    module.exports = mod;
};