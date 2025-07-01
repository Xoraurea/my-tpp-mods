/* Event Commander – event-commander/interactions.js
   Functions for interactions with the event manager UI and modal dialogs */

{
    const fs = nw.require("fs");

    /* If a package import fails, we want to clean up the events that got added. */
    let lastRegisteredEvents = [];

    /* Code for this pinched from https://stackoverflow.com/a/2117523. */
    const generateUuid = () => {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
        );
    };

    const registerNewPackage = (customEvents, currentCatalogue, fileObj) => {
        /* If there's a name, we're done here! Just add the package and return. */
        const newPackageEntry = {
            version: fileObj.version,
            uuid: fileObj.uuid,
            name: fileObj.name,
            events: []
        };

        /* We need to do a first pass for collisions. */
        for(let evtIndex = 0; evtIndex < fileObj.events.length; evtIndex++){
            let newEvent = fileObj.events[evtIndex];

            /* If there's a collision, we want to still be able to distinguish events without
               requiring one to be renamed. We'll use the package UUID for this. */
            if(customEvents.events.find(evtObj => evtObj.id === newEvent.id)){
                const originalId = newEvent.id;
                newEvent.id = newEvent.id + "-" + fileObj.uuid;

                /* Other event IDs are referenced in event effects. */
                const checkEffects = (target) => {
                    target.effects.forEach(evtEffect => {
                        if(evtEffect.eventID && evtEffect.eventID === originalId){
                            evtEffect.eventID = newEvent.id;
                        }
                    });
                };

                /* Because some events may be sub-events, we need to check *every* event in the
                   package to make sure they're correctly updated. */
                fileObj.events.forEach(chkEvent => {
                    if(chkEvent.effects) checkEffects(chkEvent);
                    if(chkEvent.options) chkEvent.options.forEach(checkEffects);
                });
            }
        }

        /* Now we add the events. */
        fileObj.events.forEach(newEvent => {
            newPackageEntry.events.push(newEvent.id);
            customEvents.events.push(newEvent);

            lastRegisteredEvents.push(newEvent.id);
        });

        currentCatalogue.packages.push(newPackageEntry);
    };

    async function requestPackageName(promptTitle, promptMessage, backDiv){
        let dynamicPrompt = false;

        if(backDiv === undefined){
            dynamicPrompt = true;

            backDiv = document.createElement("div");
            backDiv.setAttribute("class", "evtCmdrDialogBack");
            document.body.appendChild(backDiv);
        }
        
        const mainDiv = document.createElement("div");
        mainDiv.setAttribute("class", "evtCmdrDialogMain");
        backDiv.appendChild(mainDiv);

        const titleHeader = document.createElement("h2");
        titleHeader.textContent = promptTitle;
        mainDiv.appendChild(titleHeader);
        mainDiv.appendChild(document.createElement("hr"));

        const infoDiv = document.createElement("div");
        infoDiv.setAttribute("class", "evtCmdrDialogInfo");
        infoDiv.textContent = promptMessage;
        mainDiv.appendChild(infoDiv);

        const nameInputBox = document.createElement("input");
        nameInputBox.setAttribute("class", "evtCmdrDialogInput");
        nameInputBox.setAttribute("type", "text");
        mainDiv.appendChild(nameInputBox);

        const okayButton = document.createElement("button");
        okayButton.setAttribute("class", "evtCmdrControlButton");
        okayButton.setAttribute("id", "evtCmdrSoloButton");
        okayButton.textContent = "OK";
        mainDiv.appendChild(okayButton);

        nameInputBox.onkeydown = (keyEvent) => {
            /* If the player presses enter in the name field, we should
               act as if OK has been clicked. */
            if(keyEvent.keyCode === 13) okayButton.click();
        };

        nameInputBox.focus();

        /* Now we do weird Promise trickery. */
        return await new Promise(resolve => {
            okayButton.onclick = () => {
                playClick();

                /* Check if the player has actually put a name in. */
                if(nameInputBox.value !== ""){
                    if(dynamicPrompt) backDiv.remove();
                    resolve(nameInputBox.value);
                } else {
                    alertFunc("The package must be given a name before continuing.");
                }
            };
        });
    };

    async function addPackage(customEvents, currentCatalogue, callback) {
        /* This is called when the player clicks Add Event Package in the event manager. */
        const backDiv = document.createElement("div");
        backDiv.setAttribute("class", "evtCmdrDialogBack");
        document.body.appendChild(backDiv);

        /* We need to create a hidden file input element. */
        const fileInput = document.createElement("input");
        fileInput.setAttribute("type", "file");
        fileInput.setAttribute("style", "display: none;");
        fileInput.setAttribute("accept", ".json");

        /* If the user cancels, we can just remove the backdrop and continue as normal. */
        fileInput.addEventListener("cancel", () => {backDiv.remove();})

        /* If a file is selected, it's go time! We need an async function here to handle waiting
           for our dialog modal. */
        async function changeHandler(){
            if(fileInput.value !== null){
                try {
                    /* Clear the clean-up array. */
                    lastRegisteredEvents = [];

                    const fileText = fs.readFileSync(fileInput.value, "utf8");
                    const fileObj = JSON.parse(fileText);

                    if(!fileObj.version || !fileObj.events){
                        throw new Error("Not a valid event package");
                    }

                    if(!fileObj.uuid){
                        fileObj.uuid = generateUuid();
                    }

                    const existingPackage = currentCatalogue.packages.find(package => (package.uuid === fileObj.uuid));

                    if(!existingPackage){
                        if(!fileObj.name){
                            /* We need to pop up a modal for the player to name the package. */
                            const newName = await requestPackageName("Package Name Needed",
                                "The event package file selected hasn't been given a name by its creator. Please enter a name to refer to it by.",
                                backDiv);
                            fileObj.name = newName;
                        }
    
                        /* We're all done! */
                        registerNewPackage(customEvents, currentCatalogue, fileObj);
    
                        backDiv.remove();
                        callback();
                    } else {
                        alertFunc("This package's identifier conflicts with " + existingPackage.name + ". To install this package, " + existingPackage.name + " must be removed.");
                        backDiv.remove();
                    }
                } catch {
                    /* We should clean up any events that got added. */
                    customEvents.events = customEvents.events.filter(candEvent => !lastRegisteredEvents.includes(candEvent.id));

                    backDiv.remove();
                    alertFunc("The JSON file selected couldn't be parsed as a valid event file.");
                }
            };
        }

        fileInput.addEventListener("change", () => {
            changeHandler();
        });

        fileInput.value = null;

        /* Now fake a click to trigger the open file dialog. */
        fileInput.click();
    }

    /* For some interactions, we want a simple yes/no dialog. */
    async function promptYesNo(promptTitle, promptMessage){
        const backDiv = document.createElement("div");
        backDiv.setAttribute("class", "evtCmdrDialogBack");
        document.body.appendChild(backDiv);

        const mainDiv = document.createElement("div");
        mainDiv.setAttribute("class", "evtCmdrDialogMain");
        backDiv.appendChild(mainDiv);

        const titleHeader = document.createElement("h2");
        titleHeader.textContent = promptTitle;
        mainDiv.appendChild(titleHeader);
        mainDiv.appendChild(document.createElement("hr"));

        const infoDiv = document.createElement("div");
        infoDiv.setAttribute("class", "evtCmdrDialogInfo");
        infoDiv.textContent = promptMessage;
        mainDiv.appendChild(infoDiv);

        const controlDiv = document.createElement("div");
        controlDiv.setAttribute("class", "evtCmdrDialogControls");
        mainDiv.appendChild(controlDiv);

        const yesButton = document.createElement("button");
        yesButton.setAttribute("class", "evtCmdrControlButton");
        yesButton.textContent = "Yes";
        controlDiv.appendChild(yesButton);

        const noButton = document.createElement("button");
        noButton.setAttribute("class", "evtCmdrControlButton");
        noButton.textContent = "No";
        controlDiv.appendChild(noButton);

        return await new Promise(resolve => {
            yesButton.onclick = () => {
                playClick();
                backDiv.remove();
                resolve(true);
            };
            noButton.onclick = () => {
                playClick();
                backDiv.remove();
                resolve(false);
            };
        });
    };

    const createDialogPackageListEntry = (package, backDiv, customEvents, callback) => {
        /* Create the top-level list items. */
        const entryDiv = document.createElement("div");
        entryDiv.setAttribute("class", "evtCmdrListItem");

        /* Create the root item line. */
        const rootDiv = document.createElement("div");
        rootDiv.setAttribute("class", "evtCmdrItemRoot");
        entryDiv.appendChild(rootDiv);

        const expandHideButton = document.createElement("button");
        expandHideButton.setAttribute("class", "evtCmdrExpandButton");
        expandHideButton.textContent = "+";
        rootDiv.appendChild(expandHideButton);

        const packageLabelDiv = document.createElement("a");
        packageLabelDiv.setAttribute("class", "evtCmdrPackageLabel");
        packageLabelDiv.textContent = `${package.name} (${package.events.length} event${(package.events.length !== 1) ? "s" : ""})`;
        rootDiv.appendChild(packageLabelDiv);

        packageLabelDiv.onclick = () => {
            playClick();
            backDiv.remove();
            callback(package);
        };

        /* Add the list of events within the package. */
        const childListDiv = document.createElement("div");
        childListDiv.setAttribute("class", "evtCmdrChildList");
        childListDiv.setAttribute("style", "display: none;");
        entryDiv.appendChild(childListDiv);

        /* Add a handler for the expand/hide button. */
        let listExpanded = false;

        expandHideButton.onclick = () => {
            playClick();
            
            listExpanded = !listExpanded;
            expandHideButton.textContent = (listExpanded) ? "–" : "+";

            if(listExpanded) childListDiv.removeAttribute("style");
            else childListDiv.setAttribute("style", "display: none");
        };

        /* Add child items for every event. */
        package.events.forEach(evtId => {
            const eventObj = customEvents.events.find(event => (event.id === evtId));

            const eventItemDiv = document.createElement("div");
            eventItemDiv.setAttribute("class", "evtCmdrChildItem");
            childListDiv.appendChild(eventItemDiv);

            const eventHeaderDiv = document.createElement("div");
            eventHeaderDiv.setAttribute("class", "evtCmdrChildHeader");
            eventItemDiv.appendChild(eventHeaderDiv);

            const eventTitleSpan = document.createElement("span");
            eventTitleSpan.textContent = evtId;
            eventHeaderDiv.appendChild(eventTitleSpan);

            if(eventObj.devDesc !== ""){
                const eventDescDiv = document.createElement("div");
                eventDescDiv.setAttribute("class", "evtCmdrChildDesc");
                eventDescDiv.textContent = eventObj.devDesc;
                eventItemDiv.appendChild(eventDescDiv);
            }
        });

        return entryDiv;
    };

    const createDialogEventListEntry = (package, backDiv, customEvents, callback) => {
        /* Create the top-level list items. */
        const entryDiv = document.createElement("div");
        entryDiv.setAttribute("class", "evtCmdrListItem");

        /* Create the root item line. */
        const rootDiv = document.createElement("div");
        rootDiv.setAttribute("class", "evtCmdrItemRoot");
        entryDiv.appendChild(rootDiv);

        const expandHideButton = document.createElement("button");
        expandHideButton.setAttribute("class", "evtCmdrExpandButton");
        expandHideButton.textContent = "+";
        rootDiv.appendChild(expandHideButton);

        const packageLabelDiv = document.createElement("div");
        packageLabelDiv.setAttribute("class", "evtCmdrPackageLabel");
        packageLabelDiv.textContent = `${package.name} (${package.events.length} event${(package.events.length !== 1) ? "s" : ""})`;
        rootDiv.appendChild(packageLabelDiv);

        /* Add the list of events within the package. */
        const childListDiv = document.createElement("div");
        childListDiv.setAttribute("class", "evtCmdrChildList");
        childListDiv.setAttribute("style", "display: none;");
        entryDiv.appendChild(childListDiv);

        /* Add a handler for the expand/hide button. */
        let listExpanded = false;

        expandHideButton.onclick = () => {
            playClick();
            
            listExpanded = !listExpanded;
            expandHideButton.textContent = (listExpanded) ? "–" : "+";

            if(listExpanded) childListDiv.removeAttribute("style");
            else childListDiv.setAttribute("style", "display: none");
        };

        /* Add child items for every event. */
        package.events.forEach(evtId => {
            const eventObj = customEvents.events.find(event => (event.id === evtId));

            const eventItemDiv = document.createElement("div");
            eventItemDiv.setAttribute("class", "evtCmdrChildItem");
            childListDiv.appendChild(eventItemDiv);

            const eventHeaderDiv = document.createElement("a");
            eventHeaderDiv.setAttribute("class", "evtCmdrChildHeader");
            eventItemDiv.appendChild(eventHeaderDiv);

            eventHeaderDiv.onclick = () => {
                playClick();
                backDiv.remove();
                callback(evtId);
            };

            const eventTitleSpan = document.createElement("span");
            eventTitleSpan.textContent = evtId;
            eventHeaderDiv.appendChild(eventTitleSpan);

            if(eventObj.devDesc !== ""){
                const eventDescDiv = document.createElement("div");
                eventDescDiv.setAttribute("class", "evtCmdrChildDesc");
                eventDescDiv.textContent = eventObj.devDesc;
                eventItemDiv.appendChild(eventDescDiv);
            }
        });

        return entryDiv;
    };

    /* We need dialogs for event creators to select packages and events. */
    const selectTargetDialog = (isPackage, promptTitle, promptMessage, customEvents, currentCatalogue, callback, newPackageOpt, writeChanges, closeback) => {
        /* Create the dialog elements. */
        const backDiv = document.createElement("div");
        backDiv.setAttribute("class", "evtCmdrDialogBack");
        document.body.appendChild(backDiv);

        const mainDiv = document.createElement("div");
        mainDiv.setAttribute("class", "evtCmdrDialogMain");
        backDiv.appendChild(mainDiv);

        const titleHeader = document.createElement("h2");
        titleHeader.textContent = promptTitle;
        mainDiv.appendChild(titleHeader);
        mainDiv.appendChild(document.createElement("hr"));

        const infoDiv = document.createElement("div");
        infoDiv.setAttribute("class", "evtCmdrDialogInfo");
        infoDiv.textContent = promptMessage;
        mainDiv.appendChild(infoDiv);

        const closeButton = document.createElement("button");
        closeButton.setAttribute("class", "evtCmdrListClose");
        closeButton.textContent = "X";

        closeButton.onclick = () => {
            playClick();
            if(closeback) closeback();
            backDiv.remove();
        };

        mainDiv.appendChild(closeButton);

        /* Create the list itself. */
        const listDiv = document.createElement("div");
        listDiv.setAttribute("class", "evtCmdrListDiv");
        mainDiv.appendChild(listDiv);

        const entryHandler = (isPackage) ? createDialogPackageListEntry : createDialogEventListEntry;

        currentCatalogue.packages.forEach(package => {
            listDiv.appendChild(entryHandler(package, backDiv, customEvents, callback));
        });

        /* Add a 'fake' package for unpackaged events. */
        const unpackagedRootDiv = entryHandler({
            name: "Unpackaged Events",
            events: currentCatalogue.unsorted
        }, backDiv, customEvents, callback);

        listDiv.appendChild(unpackagedRootDiv);

        /* If applicable, add the new package button. */
        if(newPackageOpt){
            const controlDiv = document.createElement("div");
            controlDiv.setAttribute("id", "evtCmdrControlDiv");
            mainDiv.appendChild(controlDiv);

            const newPackageButton = document.createElement("button");
            newPackageButton.setAttribute("class", "evtCmdrControlButton");
            newPackageButton.textContent = "Create New Package";
            controlDiv.appendChild(newPackageButton);

            async function newClickHandler(){
                playClick();

                const newPackage = {
                    version: Executive.game.version,
                    uuid: generateUuid(),
                    events: []
                };

                const packageName = await requestPackageName("Enter Package Name", "Enter a name for the new custom event package.");
                newPackage.name = packageName;

                currentCatalogue.packages.push(newPackage);
                listDiv.insertBefore(entryHandler(newPackage, backDiv, customEvents, callback), unpackagedRootDiv);

                writeChanges();
            }

            newPackageButton.onclick = () => {
                newClickHandler();
            };
        }
    };

    const selectTargetPackage = (promptTitle, promptMessage, customEvents, currentCatalogue, callback, newPackageOpt, writeChanges, closeback) => {
        selectTargetDialog(true, promptTitle, promptMessage, customEvents, currentCatalogue, callback, newPackageOpt, writeChanges, closeback);
    };

    const selectTargetEvent = (promptTitle, promptMessage, customEvents, currentCatalogue, callback) => {
        selectTargetDialog(false, promptTitle, promptMessage, customEvents, currentCatalogue, callback);
    };

    module.exports = {
        generateUuid,
        addPackage,
        requestPackageName,
        promptYesNo,
        selectTargetPackage,
        selectTargetEvent
    };
};