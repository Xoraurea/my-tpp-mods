/* Better Election Maps – better-maps/proxies.js
   Creates proxies for electNight<type> objects so they can be indexed by district ID. */

{
    const proxies = {};

    proxies.usSenate = new Proxy({}, {
        get: (target, property) => {
            const refinedList = electNightUSS.elections.filter(
                stateEntry => (stateEntry.state.toLowerCase() === property.toLowerCase()));
            if(refinedList.length === 0) return undefined;
            return refinedList[0];
        }
    });

    proxies.president = new Proxy({}, {
        get: (target, property) => {
            const refinedList = electNightP.elections.filter(
                stateEntry => (stateEntry.state.toLowerCase() === property.toLowerCase()));
            if(refinedList.length === 0) return undefined;
            return refinedList[0];
        }
    });

    proxies.governor = new Proxy({}, {
        get: (target, property) => {
            const refinedList = electNightG.elections.filter(
                stateEntry => (stateEntry.state.toLowerCase() === property.toLowerCase()));
            if(refinedList.length === 0) return undefined;
            return refinedList[0];
        }
    });

    proxies.usHouse = new Proxy({}, {
        get: (target, property) => {
            const refinedList = electNightUSH.elections.filter(
                districtEntry => (districtEntry.state.toLowerCase() === property.toLowerCase()));
            if(refinedList.length === 0) return undefined;

            let projectedDem = 0;
            let projectedRep = 0;

            refinedList.forEach(district => {
                if(district.cands === undefined || district.pW === false) return;

                const sortedCands = district.cands.slice().sort((cand1, cand2) => {
                    return cand2.votes - cand1.votes;
                });

                const winner = sortedCands[0];
                const winnerParty = (winner.party !== "I") ? winner.party : winner.caucus;

                if(winnerParty === "D") projectedDem++;
                else projectedRep++;
            });

            return {
                districts: refinedList,
                projectedDem,
                projectedRep
            };
        }
    });

    proxies.usHousePol = new Proxy({}, {
        get: (target, property) => {
            const refinedList = Executive.data.politicians.usHouse[property.toLowerCase()];
            if(refinedList === undefined || refinedList.length === 0) return undefined;

            let projectedDem = 0;
            let projectedRep = 0;

            refinedList.forEach(incumbent => {
                const winnerParty = incumbent.caucusParty;

                if(winnerParty === "Democrat") projectedDem++;
                else projectedRep++;
            });

            return {
                districts: refinedList,
                projectedDem,
                projectedRep
            };
        }
    });

    proxies.governorPol = Executive.data.politicians.governors;
    proxies.usSenatePol = Executive.data.politicians.usSenate;

    module.exports = proxies;
};

