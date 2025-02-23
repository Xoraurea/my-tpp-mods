/* Better Election Maps – better-maps/tooltip.js
   Sets up the tooltip and supporting functions. */

{
    const resultProxies = require("./proxies.js");
    const {getCandidateColour, stringifyColour} = require("./colours.js");

    const tooltipDiv = document.createElement("div");
    tooltipDiv.setAttribute("style", "display: none;");
    tooltipDiv.setAttribute("id", "better-maps-tooltip");

    const tooltipComponents = {};

    const createTooltipEntry = (cand, district, live) => {
        const entryMainDiv = document.createElement("div");
        entryMainDiv.setAttribute("class", "better-maps-tooltip-entry");
        
        /* Create the tab at the side showing the colour of the candidate's party/caucus. */
        const partyTabDiv = document.createElement("div");
        partyTabDiv.setAttribute("class", "better-maps-tooltip-party-tab");
        partyTabDiv.setAttribute("style", `background-color: ${stringifyColour(getCandidateColour(cand))};`);
        entryMainDiv.appendChild(partyTabDiv);

        const mainContainerDiv = document.createElement("div");
        mainContainerDiv.setAttribute("class", "better-maps-tooltip-entry-main");
        entryMainDiv.appendChild(mainContainerDiv);

        /* Remove the first name from the candidate's full name. */
        const croppedName = cand.name.substring(cand.name.indexOf(" ") + 1) + (cand.incumbent === true ? "*" : "");

        /* Add the bottom row for the name and the vote share. */
        const entryTopRow = document.createElement("div");
        entryTopRow.setAttribute("class", "better-maps-tooltip-entry-top");
        mainContainerDiv.appendChild(entryTopRow);

        const nameDiv = document.createElement("div");
        nameDiv.innerText = croppedName;
        entryTopRow.appendChild(nameDiv);

        const candVotes = live ? cand.currentVotes : cand.votes;
        const distVotes = live ? district.totalCurrVotes : district.totalVotes;

        const voteShareDiv = document.createElement("div");
        voteShareDiv.setAttribute("class", "better-maps-tooltip-vote-share");
        voteShareDiv.innerText = `${((candVotes / distVotes) * 100).toFixed(1)}%`;
        entryTopRow.appendChild(voteShareDiv);

        /* Add the bottom row for the popular vote count and, if appropriate, the lead. */
        const entryBottomRow = document.createElement("div");
        entryBottomRow.setAttribute("class", "better-maps-tooltip-vote-count");
        entryBottomRow.innerText = Math.round(candVotes).toLocaleString();
        mainContainerDiv.appendChild(entryBottomRow);

        return {main: entryMainDiv, topRow: entryTopRow, countRow: entryBottomRow};
    };
    
    const createNewEntries = (currentDistrict, live, fillTop, primary) => {
        /* Add the current percentage reported. */
        const percentReported = Math.round((currentDistrict.totalCurrVotes / currentDistrict.totalVotes) * 100);
        if(!primary) tooltipComponents.reporting.innerText = percentReported.toLocaleString() + "% reporting";

        let highestTotal = 0; let winnerEntry = null; let winner = null;
        let currentHighestTotal = 0; let currentHighestEntry = null;

        const sortedCands = currentDistrict.cands.slice().sort((cand1, cand2) => {
            if(live) return cand2.currentVotes - cand1.currentVotes;
            return cand2.votes - cand1.votes;
        });

        let currentIndex = 0;

        /* Add entries and find our current leader and winner. */
        sortedCands.forEach(candidate => {
            const newEntry = createTooltipEntry(candidate, currentDistrict, live);
            tooltipComponents.entries.appendChild(newEntry.main);

            if(currentIndex === 0) currentHighestEntry = newEntry;
            if(candidate.votes >= highestTotal){
                highestTotal = candidate.votes;
                winnerEntry = newEntry;
                winner = candidate;
            }

            if(candidate.win !== undefined && (primary === false || live === false)){
                if(candidate.win) newEntry.topRow.setAttribute("style", "font-weight: bold;");
            }

            currentIndex++;
        });

        /* Now we go back around one more time to get the highest candidate's lead. */
        let currentSecondVotes = 0; let currentSecondEntry = undefined;
        const reducedArray = sortedCands.filter(newCand => (newCand !== winner));

        reducedArray.forEach(candidate => {
            if(candidate.currentVotes >= currentSecondVotes){
                currentSecondVotes = (live ? candidate.currentVotes : candidate.votes);
                currentSecondEntry = candidate.entry;
            }
        });

        const highestVotes = live ? sortedCands[0].currentVotes : sortedCands[0].votes;

        /* Add lead to the current leader's entry. */
        currentHighestEntry.countRow.innerText = `(+${(Math.round(highestVotes) - Math.round(currentSecondVotes)).toLocaleString()}) `
            + currentHighestEntry.countRow.innerText;

        /* If there's a projected winner, show a line at the top with the party colour of the winner.
           In addition, make the winner's entry bold. */
        if(currentDistrict.pW === true || !live){
            if(fillTop) tooltipComponents.winnerLine.setAttribute("style", `background-color: ${stringifyColour(getCandidateColour(winner))};`);
            winnerEntry.topRow.setAttribute("style", "font-weight: bold;");
        }
    };

    const updateTooltip = (electionType, districtId, force, live) => {
        if(tooltipComponents.properties.visible === false) return;

        if(electionType === tooltipComponents.properties.electionType
            && districtId === tooltipComponents.properties.districtId && force !== true) return;

        tooltipComponents.properties.electionType = electionType;
        tooltipComponents.properties.districtId = districtId;

        let currentResults = resultProxies[electionType];
        let currentDistrict = currentResults[districtId];

        /* Set the district name. For now, this will always be a state name. */
        tooltipComponents.title.innerText = Executive.data.states[districtId].name;

        /* Reset the components ready to be set for the new district. */
        tooltipComponents.winnerLine.setAttribute("style", "display: none;");
        tooltipComponents.notCounting.setAttribute("style", "display: none;");

        tooltipComponents.reporting.innerText = "";

        while(tooltipComponents.entries.firstChild) tooltipComponents.entries.firstChild.remove();

        /* Check if there was an election in the district in the last cycle. */
        if(currentDistrict === undefined){
            tooltipComponents.noElection.removeAttribute("style");
            return;
        } else {
            tooltipComponents.noElection.setAttribute("style", "display: none;")
        }

        /* We need to determine if this is a primary or a general election. */
        if(currentDistrict.cands === undefined){
            if(live && electionType !== "president"){
                tooltipComponents.properties.visible = false;
                tooltipDiv.setAttribute("style", "display: none;");
                return;
            }
            
            /* We create a fake completed district for each party and use that to populate the tooltip.
               If there are no party candidates, it's a non-partisan primary and we just show the one result. */
            if(currentDistrict.dem.cands.length === 0 && currentDistrict.rep.cands.length === 0){
                let voteTotal = 0;
                let newCandArray = [];

                currentDistrict.allCands.cands.forEach(candidate => {
                    voteTotal += (live ? candidate.currentVotes : candidate.votes);

                    /* Because the game is silly and doesn't include party affiliations with non-affiliated candidates,
                       we have to instead fetch the candidate's player object by internal ID and wrap it using the
                       Executive API to get the candidate's party affiliation. */
                    const newCand = Object.assign({}, candidate);
                    const candArray = findCandByID([candidate.id])[0];

                    const wrappedCandObj = Executive.data.characters.wrapCharacter(
                        candArray,
                        "candidate"
                    );
                    
                    if(wrappedCandObj.extendedAttribs.party === "Independent"){
                        newCand.caucus = wrappedCandObj.party.substring(0, 1);
                    }

                    newCand.party = wrappedCandObj.extendedAttribs.party.substring(0, 1);
                    newCandArray.push(newCand);
                });

                if(live && voteTotal === 0){
                    tooltipComponents.notCounting.removeAttribute("style");
                    return;
                }

                const fakeDistrict = {
                    totalVotes: voteTotal,
                    totalCurrVotes: voteTotal,
                    cands: newCandArray,
                    pW: false
                };

                createNewEntries(fakeDistrict, live, false, true);
            } else {
                if(currentDistrict.dem.cands.length !== 0){
                    let demVoteTotal = 0;
                    let newDemCandArray = [];

                    currentDistrict.dem.cands.forEach(candidate => {
                        demVoteTotal += (live ? candidate.currentVotes : candidate.votes);

                        const newCand = Object.assign({}, candidate);
                        newCand.party = "D";
                        newDemCandArray.push(newCand);
                    });

                    const demFakeDistrict = {
                        totalVotes: demVoteTotal,
                        totalCurrVotes: demVoteTotal,
                        cands: newDemCandArray,
                        pW: false
                    };

                    if(live && demVoteTotal === 0){
                        tooltipComponents.notCounting.removeAttribute("style");
                        return;
                    }

                    createNewEntries(demFakeDistrict, live, false, true);

                    if(currentDistrict.rep.cands.length !== 0){
                        tooltipComponents.entries.appendChild(document.createElement("hr"));
                    }
                }
                if(currentDistrict.rep.cands.length !== 0) {
                    let repVoteTotal = 0;
                    let newRepCandArray = [];

                    currentDistrict.rep.cands.forEach(candidate => {
                        repVoteTotal += (live ? candidate.currentVotes : candidate.votes);

                        const newCand = Object.assign({}, candidate);
                        newCand.party = "R";
                        newRepCandArray.push(newCand);
                    });

                    const repFakeDistrict = {
                        totalVotes: repVoteTotal,
                        totalCurrVotes: repVoteTotal,
                        cands: newRepCandArray,
                        pW: false
                    };

                    createNewEntries(repFakeDistrict, live, false, true);
                }
            }
        } else {
            /* This is a nice and simple general election. */
            if(live && currentDistrict.totalCurrVotes === 0){
                tooltipComponents.notCounting.removeAttribute("style");
            } else createNewEntries(currentDistrict, live, true, false);
        }
    };

    const createTooltip = () => {
        tooltipComponents.properties = {
            visible: false,
            targetDistrict: null,
            electionType: "",
            districtId: ""
        };

        tooltipComponents.winnerLine = document.createElement("div");
        tooltipComponents.winnerLine.setAttribute("id", "better-maps-tooltip-win-line");
        tooltipComponents.winnerLine.setAttribute("style", "display: none;");
        tooltipDiv.appendChild(tooltipComponents.winnerLine);

        tooltipComponents.header = document.createElement("div");
        tooltipComponents.header.setAttribute("id", "better-maps-tooltip-header");
        tooltipDiv.appendChild(tooltipComponents.header);
        
        tooltipComponents.title = document.createElement("div");
        tooltipComponents.title.setAttribute("id", "better-maps-tooltip-title");
        tooltipComponents.header.appendChild(tooltipComponents.title);

        tooltipComponents.reporting = document.createElement("div");
        tooltipComponents.reporting.setAttribute("id", "better-maps-tooltip-reporting");
        tooltipComponents.header.appendChild(tooltipComponents.reporting);

        const divider = document.createElement("hr");
        tooltipDiv.appendChild(divider);

        tooltipComponents.noElection = document.createElement("div");
        tooltipComponents.noElection.innerText = "No election was held in this state this cycle.";
        tooltipComponents.noElection.setAttribute("id", "better-maps-tooltip-no-election");
        tooltipComponents.noElection.setAttribute("style", "display: none;");
        tooltipDiv.appendChild(tooltipComponents.noElection);

        tooltipComponents.notCounting = document.createElement("div");
        tooltipComponents.notCounting.innerText = "This state has not begun counting yet.";
        tooltipComponents.notCounting.setAttribute("id", "better-maps-tooltip-not-counted");
        tooltipComponents.notCounting.setAttribute("style", "display: none;");
        tooltipDiv.appendChild(tooltipComponents.notCounting);

        tooltipComponents.entries = document.createElement("div");
        tooltipComponents.entries.setAttribute("id", "better-maps-tooltip-entries");
        tooltipDiv.appendChild(tooltipComponents.entries);

        document.body.appendChild(tooltipDiv);
    };

    module.exports = {
        tooltipDiv,
        tooltipComponents,
        updateTooltip,
        createTooltip
    };
};