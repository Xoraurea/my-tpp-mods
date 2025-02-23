/* Better Election Maps – better-maps/main.js
   The main body of the Better Election Maps mod to be loaded first by Executive. */

/* Wrapping everything possible here in a block is good practice to avoid exposing arbitrary
   globals to other loaded mods. */
{
    const path = require("path");
    const fs = require("fs");

    const d3 = require("./third-party/d3.v7.min.js");
    const resultProxies = require("./proxies.js");

    const {getCandidateColour, getPoliticianColour, stringifyColour} = require("./colours.js");
    const {tooltipDiv, tooltipComponents, updateTooltip, createTooltip} = require("./tooltip.js");

    const mod = {};

    const originalElectPageMap = Executive.functions.getOriginalFunction("electPageMap");
    const originalElectNightMap = Executive.functions.getOriginalFunction("electNightMap");

    const originalSummaryNationMap = Executive.functions.getOriginalFunction("summaryNationMap");

    let config = null;

    const getRaceInfo = (district, live) => {
        const sortedCands = district.cands.slice().sort((cand1, cand2) => {
            if(live) return cand2.currentVotes - cand1.currentVotes;
            return cand2.votes - cand1.votes;
        });

        const topVotes = live ? sortedCands[0].currentVotes : sortedCands[0].votes;
        const secondVotes = (sortedCands[1] !== undefined) ? (live ? sortedCands[1].currentVotes : sortedCands[1].votes) : 0;

        const info = {
            currentLeader: sortedCands[0],
            currentLead: topVotes - secondVotes
        };

        if(district.pW){
            const resortedCands = sortedCands.sort((cand1, cand2) => {
                return cand2.votes - cand1.votes;
            });
            info.finalWinner = resortedCands[0];
        }

        return info;
    };

    const updateMap = (svgMap, resultColours, electionType, live, projected) => {
        svgMap.setAttribute("data-colours", JSON.stringify(resultColours));

        const resultKeys = Object.keys(resultColours);

        const raceInfoCache = {};
        const majorities = [];
        let majorityScale = null;

        if(electionType === "usHouse" || electionType === "usHousePol") {
            majorityScale = d3.scaleLinear(
                d3.extent([0, 1]),
                [0.625, 1.375]
            );
        } else if(!projected) {
            resultKeys.forEach(stateId => {
                const currentDistrict = resultProxies[electionType][stateId];

                if(currentDistrict !== undefined && currentDistrict.cands !== undefined) {
                    raceInfoCache[stateId] = getRaceInfo(currentDistrict, live);

                    const distMajority = raceInfoCache[stateId].currentLead / (live ? currentDistrict.totalCurrVotes : currentDistrict.totalVotes);

                    if(distMajority !== 1) majorities.push(distMajority);
                    raceInfoCache[stateId].currentMajority = distMajority;
                }
            });

            if(majorities.length > 0){
                majorityScale = d3.scaleLinear(
                    d3.extent(majorities),
                    [0.625, 1.375]
                );
            };
        }

        resultKeys.forEach(stateId => {
            const currentDistrict = resultProxies[electionType][stateId];

            if(currentDistrict !== undefined && (electionType === "usHouse" || electionType === "usHousePol" 
                || electionType === "governorPol" || electionType === "usSenatePol" 
                || currentDistrict.cands !== undefined)) {
                let raceInfo = null;
                let newColour = null;

                if(electionType === "usHouse" || electionType === "usHousePol") {
                    const leadParty = (currentDistrict.projectedDem > currentDistrict.projectedRep) ? "D" : "R";
                    const baseColour = config.partyColours[leadParty];

                    const majority = ((leadParty === "D") ? (currentDistrict.projectedDem - currentDistrict.projectedRep) : (currentDistrict.projectedRep - currentDistrict.projectedDem))
                                        / (currentDistrict.projectedDem + currentDistrict.projectedRep);

                    if(currentDistrict.projectedDem - currentDistrict.projectedRep === 0) newColour = resultColours[stateId];
                    else {
                        const scaleNum = (majority * 0.5) + 0.5;
                        const inverseLightness = (100 - baseColour.l) * scaleNum;

                        newColour = stringifyColour({
                            h: baseColour.h,
                            s: baseColour.s * scaleNum,
                            l: (100 - inverseLightness)
                        });
                    }
                } else if (electionType === "usSenatePol") {
                    if(currentDistrict.senior.extendedAttribs.party === currentDistrict.junior.extendedAttribs.party){
                        newColour = stringifyColour(getPoliticianColour(currentDistrict.senior));
                    } else {
                        const seniorAcronym = (currentDistrict.senior.extendedAttribs.party === "Independent")
                            ? ("I" + currentDistrict.senior.caucusParty.charAt(0))
                            : currentDistrict.senior.caucusParty.charAt(0);

                        const juniorAcronym = (currentDistrict.junior.extendedAttribs.party === "Independent")
                            ? ("I" + currentDistrict.junior.caucusParty.charAt(0))
                            : currentDistrict.junior.caucusParty.charAt(0);

                        newColour = `url(#${seniorAcronym}:${juniorAcronym})`;
                    }
                } else if (electionType === "governorPol") {
                    newColour = stringifyColour(getPoliticianColour(currentDistrict));
                } else if(projected) {
                    let lastElectionYear = null;
                    let lastElectionArray = null;

                    if(electionType === "usSenate"){
                        lastElectionArray = usSenateArchive;
                        lastElectionYear = lastElectionArray[0].year - 6;
                    }

                    if(electionType === "governor"){
                        lastElectionArray = allGovArchive;
                        lastElectionYear = lastElectionArray[0].year - 4;
                    }

                    raceInfo = getRaceInfo(currentDistrict, live);
                    newColour = (currentDistrict.pW === true) ? stringifyColour(getCandidateColour(raceInfo.finalWinner))
                        : (!live ? stringifyColour(getCandidateColour(raceInfo.currentLeader)) : resultColours[stateId]);

                    if(lastElectionYear !== null && currentDistrict.pW === true){
                        const lastElections = lastElectionArray.filter(archiveArray => (archiveArray.category === "general" && archiveArray.year === lastElectionYear));
                        if(lastElections.length !== 0){
                            const lastElection = lastElections[0];
                            const distFullName = Executive.data.states[stateId.toLowerCase()].name;

                            const lastDistricts = lastElection.elections.filter(dist => dist.district === distFullName);
                            if(lastDistricts.length !== 0){
                                const oldRaceInfo = getRaceInfo(lastDistricts[0], false);
                                if(oldRaceInfo.currentLeader.party !== raceInfo.currentLeader.party
                                    || oldRaceInfo.currentLeader.caucus !== raceInfo.currentLeader.caucus){
                                    const fillId = ((raceInfo.currentLeader.party === "I") ? ("I" + raceInfo.currentLeader.caucus)
                                        : raceInfo.currentLeader.caucus) + ":gain";
                                    
                                    newColour = `url(#${fillId})`;
                                }
                            }
                        }
                    }
                } else {
                    raceInfo = raceInfoCache[stateId];
                    if(raceInfo === undefined || raceInfo.currentLead === 0) newColour = resultColours[stateId];
                    else {
                        const baseColour = getCandidateColour(raceInfo.currentLeader);
                        const scaleNum = (raceInfo.currentMajority !== 1) ? majorityScale(raceInfo.currentMajority)
                            : majorityScale(d3.max(majorities));
                        const inverseLightness = (100 - baseColour.l) * scaleNum;

                        newColour = stringifyColour({
                            h: baseColour.h,
                            s: baseColour.s * scaleNum,
                            l: (100 - inverseLightness)
                        });
                    }
                }

                d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                    .style("fill", newColour);
            } else d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                .style("fill", resultColours[stateId]);
        });
    };

    const createHatchPattern = (backColour, foreColour) => {
        /* Create a single hatch fill SVG pattern. */
        const mainPatternElem = document.createElementNS("http://www.w3.org/2000/svg", "pattern");

        mainPatternElem.setAttribute("width", "10");
        mainPatternElem.setAttribute("height", "10");
        mainPatternElem.setAttribute("patternTransform", "rotate(45 0 0)");
        mainPatternElem.setAttribute("patternUnits", "userSpaceOnUse");

        const backRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        backRect.setAttribute("x", "0");
        backRect.setAttribute("y", "0");
        backRect.setAttribute("width", "10");
        backRect.setAttribute("height", "10");
        backRect.setAttribute("fill", backColour);

        mainPatternElem.appendChild(backRect);

        const hatchLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

        hatchLine.setAttribute("x1", "0");
        hatchLine.setAttribute("y1", "0");
        hatchLine.setAttribute("x2", "0");
        hatchLine.setAttribute("y2", "10");
        hatchLine.setAttribute("style", `stroke: ${foreColour}; stroke-width: 8;`);

        mainPatternElem.appendChild(hatchLine);

        return mainPatternElem;
    };

    const createPartyPattern = (party1, party2) => {
        const partyCol1 = (party1.charAt(0) === "I") ? (config.partyColours.I[party1.charAt(1)])
                                : (config.partyColours[party1.charAt(0)]);
        const partyCol2 = (party2.charAt(0) === "I") ? (config.partyColours.I[party2.charAt(1)])
                                : (config.partyColours[party2.charAt(0)]);

        const partyColStr1 = stringifyColour(partyCol1);
        const partyColStr2 = stringifyColour(partyCol2);

        const pattern = createHatchPattern(partyColStr1, partyColStr2);
        pattern.setAttribute("id", party1 + ":" + party2);

        return pattern;
    };

    const createGainPattern = (party) => {
        const partyCol = (party.charAt(0) === "I") ? (config.partyColours.I[party.charAt(1)])
                                : (config.partyColours[party.charAt(0)]);
        
        const partyColDarker = Object.assign({}, partyCol);
        partyColDarker.l = Math.max(partyCol.l - 10, 0);

        const pattern = createHatchPattern(stringifyColour(partyCol), stringifyColour(partyColDarker));
        pattern.setAttribute("id", party + ":gain");

        return pattern;
    };

    const createCrossHatches = (svgElem) => {
        /* To show seat gains and mixed seats (like in the Politicians->Federal->Senate display), we
           want to create stripes that can be used as fills in place of solid colours. We need to
           create SVG patterns to represent the possible configurations.
           
           This code is silly, but it works. */
        svgElem.appendChild(createPartyPattern("D", "R"));
        svgElem.appendChild(createPartyPattern("R", "D"));

        svgElem.appendChild(createPartyPattern("D", "ID"));
        svgElem.appendChild(createPartyPattern("D", "IR"));
        svgElem.appendChild(createPartyPattern("R", "ID"));
        svgElem.appendChild(createPartyPattern("R", "IR"));

        svgElem.appendChild(createPartyPattern("ID", "D"));
        svgElem.appendChild(createPartyPattern("ID", "R"));
        svgElem.appendChild(createPartyPattern("IR", "D"));
        svgElem.appendChild(createPartyPattern("IR", "R"));

        svgElem.appendChild(createPartyPattern("ID", "IR"));
        svgElem.appendChild(createPartyPattern("IR", "ID"));

        svgElem.appendChild(createGainPattern("D"));
        svgElem.appendChild(createGainPattern("R"));
        svgElem.appendChild(createGainPattern("ID"));
        svgElem.appendChild(createGainPattern("IR"));
    };

    const renderMap = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        const container = canvasElem.parentElement;
        let svgMap = document.getElementById(electionType + "-map" + (live ? "-live" : ""));

        let isProjected = (projected === undefined) ? false : projected;
        if(document.getElementById(!live ? "ePageProjectB" : "eNightProjectB")){
            /* Determine whether the currently displayed map is a projection map or a margin map. */
            isProjected = document.getElementById(!live ? "ePageProjectB" : "eNightProjectB").getAttribute("class")
                === (!live ? "ePageProjectBActive" : "eNightProjectBActive");
        }

        if(!svgMap || svgMap.getAttribute("data-type") !== electionType){
            const origWidth = +(canvasElem.getAttribute("width").substring(0, canvasElem.getAttribute("width").length - 2));
            const origHeight = +(canvasElem.getAttribute("height").substring(0, canvasElem.getAttribute("height").length - 2));

            const mapPath = Executive.mods.getRelativePathPrefix() + path.sep + 
                ((electionType === "president") ? "data/presidential.svg" : "data/states.svg");

            const mapDataText = fs.readFileSync(mapPath, "utf8");
            const mapData = (new DOMParser()).parseFromString(mapDataText, "image/svg+xml");

            if(svgMap && svgMap.getAttribute("data-type") !== electionType) svgMap.remove();

            {
                svgMap = mapData.documentElement;

                const baseWidth = +svgMap.getAttribute("width");
                const baseHeight = +svgMap.getAttribute("height");

                const containerDiv = document.createElement("div");

                svgMap.setAttribute("id", electionType + "-map" + (live ? "-live" : ""));
                svgMap.setAttribute("class", "better-maps-container")
                svgMap.setAttribute("width", origWidth);
                svgMap.setAttribute("height", origHeight);
                svgMap.setAttribute("data-type", electionType);

                containerDiv.appendChild(svgMap);
                container.insertBefore(containerDiv, canvasElem);

                canvasElem.setAttribute("style", "display: none;");

                createCrossHatches(svgMap);

                const scaleFactor = Math.min(origWidth / baseWidth, origHeight / baseHeight);
                const outlineGroup = svgMap.getElementsByTagName("g")[0];

                const statePaths = outlineGroup.children;
                for(let i = 0; i < statePaths.length; i++){
                    const stateId = statePaths[i].getAttribute("id");

                    statePaths[i].setAttribute("id", stateId.toLowerCase() + "-state-path" + (live ? "-live" : ""));
                    statePaths[i].setAttribute("class", "better-maps-state-path");

                    statePaths[i].addEventListener("click", (event) => {
                        playClick();
                        activeMap = stateId;
                        if(electionType === "president") activeCampMap = Executive.data.states[stateId.toLowerCase()];
                        onClickPageFunc();
                    });

                    if(electionType !== "usHouse" && electionType !== "usHousePol"
                        && electionType !== "governorPol" && electionType !== "usSenatePol"){
                        statePaths[i].addEventListener("mousemove", (event) => {
                            tooltipDiv.setAttribute("style", `left: ${event.pageX + 10}px; top: ${event.pageY + 10}px;`);
                            tooltipComponents.properties.visible = true;
                            tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                            updateTooltip(electionType, stateId.toLowerCase(), false, live);
                        });
    
                        statePaths[i].addEventListener("mouseleave", (event) => {
                            tooltipDiv.setAttribute("style", "display: none;");
                            tooltipComponents.properties.visible = false;
                            tooltipComponents.properties.targetDistrict = null;
                        });
                    }
                }

                if(scaleFactor === (origWidth / baseWidth)){
                    outlineGroup.setAttribute("transform", `translate(0, ${(origHeight / 2) - ((baseHeight * scaleFactor) / 2)}) scale(${scaleFactor})`);
                } else {
                    outlineGroup.setAttribute("transform", `translate(${(origWidth / 2) - ((baseWidth * scaleFactor) / 2)}, 0) scale(${scaleFactor})`);
                }

                updateMap(svgMap, resultColours, electionType, live, isProjected);
            };
        } else updateMap(svgMap, resultColours, electionType, live, isProjected);

        /* Finally, update the tooltip where appropriate. */
        if(tooltipComponents.properties.targetDistrict !== null)
            updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live);
    };

    const newElectPageMap = (canvasElem, resultColours, arg2, electionType) => {
        Executive.mods.saveData.testProp = "This is another test.";

        if(electionType !== "usSenate" && electionType !== "usHouse"
            && electionType !== "governor" && electionType !== "president")
            return originalElectPageMap(canvasElem, resultColours, arg2, electionType);

        let onClickPageFunc = null;

        switch(electionType){
            case "usSenate":
                onClickPageFunc = senateElectPage
                break;
            case "usHouse":
                onClickPageFunc = houseElectPage
                break;
            case "governor":
                onClickPageFunc = governorElectPage
                break;
            case "president":
                onClickPageFunc = updateStDetails
                break;
        }

        renderMap(canvasElem, resultColours, electionType, false, onClickPageFunc,
            ((electionType === "president") ? true : undefined)
        );
    };

    const newElectNightMap = (canvasElem, resultColours, arg2, electionType) => {
        if(electionType !== "usSenate" && electionType !== "usHouse"
            && electionType !== "governor" && electionType !== "president")
            return originalElectNightMap(canvasElem, resultColours, arg2, electionType);

        let onClickPageFunc = null;

        switch(electionType){
            case "usSenate":
                onClickPageFunc = electNightUSSFunc;
                break;
            case "usHouse":
                onClickPageFunc = electNightUSHFunc;
                break;
            case "governor":
                onClickPageFunc = electNightGovFunc;
                break;
            case "president":
                onClickPageFunc = electNightPresFunc;

                /* We need to check if this is a primary – the function is different. */
                if(electNightP.elections[0].cands === undefined) onClickPageFunc = electNightPPFunc;
                break;
        }

        renderMap(canvasElem, resultColours, electionType, true, onClickPageFunc);
    };

    const newSimUSCanvas = (canvasElem, resultColours, arg2) => {
        renderMap(canvasElem, resultColours, "president", false, presElectPage);
    };

    const newSummaryNationMap = (canvasElem, resultColours, arg2, arg3) => {
        /* The game doesn't pass a reliable election type to summaryNationMap – for whatever reason,
           it's always usSenate even if the player is on the House/Governor page. As such, we need
           to detect it ourselves using the current open page. */
        let electionType = "";

        if(openPolPage1 === "nation"){
            electionType = (openPolPage2 === "legislate1") ? "usHousePol" : "usSenatePol";
        } else {
            /* The only other map outside of the nation options is the governor map. */
            electionType = "governorPol";
        }

        /* Senate/Governor implementations are slightly trickier in this case – we'll skip them for now. 
        if(electionType !== "usHousePol" && electionType !== "governorPol"){
            originalSummaryNationMap(canvasElem, resultColours, arg2, arg3);
            return;
        }*/

        let onClickPageFunc = null;

        switch(electionType){
            case "usSenatePol":
                onClickPageFunc = senatePolProfMenu;
                break;
            case "usHousePol":
                onClickPageFunc = housePolProfMenu;
                break;
            case "governorPol":
                onClickPageFunc = govPolProfMenu;
                break;
        }

        renderMap(canvasElem, resultColours, electionType, false, onClickPageFunc, true);
    };

    const createMapChangeObserver = (electionType) => () => {
        const projectButton = document.getElementById("eNightProjectB");
        if(projectButton){
            const buttonObserver = new MutationObserver((mutationList, observer) => {
                /* We don't expect any other attributes to be changing, so we can just update the map without
                    further checks. */
                const svgMap = document.getElementById(electionType + "-map-live");
                if(svgMap){
                    newElectNightMap(document.getElementById("electNightCanvas"), JSON.parse(svgMap.getAttribute("data-colours")), 0, electionType);
                }
            });

            buttonObserver.observe(projectButton, {attributes: true});
        }
    };

    const addPartyID = () => {
        if(activeMap === "US") return;

        let sidePaneContainer = document.getElementById("electPageInn2Gen");
        if(!sidePaneContainer) sidePaneContainer = document.getElementById("electPageInn2Pri");

        const titleParagraph = sidePaneContainer.getElementsByClassName("electNightInnP")[0];
        
        const state = Executive.data.states[activeMap.toLowerCase()];

        const partyIDContainer = document.createElement("p");
        partyIDContainer.setAttribute("class", "summaryInnTopPRight");
        //partyIDContainer.setAttribute("style", "display: inline-flex;");

        const demSpan = document.createElement("span");
        demSpan.setAttribute("style", "color: hsl(210, 100%, 60%);");
        demSpan.innerText = "D: " + Math.round(state.demPop * 100).toString() + "%";
        partyIDContainer.appendChild(demSpan);

        const repSpan = document.createElement("span");
        repSpan.setAttribute("style", "color: hsl(0, 100%, 60%);");
        repSpan.innerText = " R: " + Math.round(state.repPop * 100).toString() + "%";
        partyIDContainer.appendChild(repSpan);

        const indNode = document.createTextNode(" I: " + Math.round(state.indPop * 100).toString() + "%")
        partyIDContainer.appendChild(indNode);

        titleParagraph.appendChild(partyIDContainer);
    };

    mod.init = () => {
        /* Add the stylesheets for UI components. */
        Executive.styles.registerStyle("styles/general.css");
        Executive.styles.registerThemeAwareStyle("styles/light.css", "styles/dark.css");

        /* Load the mod configuration file. */
        const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
        config = JSON.parse(configText);

        /* We'll create one tooltip UI component now which is used whenever the player hovers over part of a map.
           We can use the same tooltip for every map widget, because you can't hover over two maps at once, duh. */
        createTooltip();

        Executive.functions.registerReplacement("electPageMap", newElectPageMap);
        Executive.functions.registerReplacement("electNightMap", newElectNightMap);
        Executive.functions.registerReplacement("eSimUSCanvas", newSimUSCanvas);
        Executive.functions.registerReplacement("summaryNationMap", newSummaryNationMap);

        /* On the election night view, updates to the Projections and Margins buttons occur after electNightMap is
           called. We therefore need to add a post-hook to the electNightUSSFunc and electNightGovFunc functions to
           create MutationObservers to track changes and re-render the map. */
        Executive.functions.registerPostHook("electNightUSSFunc", createMapChangeObserver("usSenate"));
        Executive.functions.registerPostHook("electNightGovFunc", createMapChangeObserver("governor"));
        Executive.functions.registerPostHook("electNightPresFunc", createMapChangeObserver("president"));

        if(config.showPanePartyID === true){
            //console.warn("[Better Maps] Support for showing party ID in the election pane is not fully implemented.");
            Executive.functions.registerPostHook("houseElectPage", addPartyID);
            Executive.functions.registerPostHook("senateElectPage", addPartyID);
            Executive.functions.registerPostHook("governorElectPage", addPartyID);
        }
    };

    module.exports = mod;
}