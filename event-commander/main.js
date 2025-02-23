/* Event Commander – event-commander/main.js
   The main body of Event Commander to be loaded first by Executive. */

/* Wrapping everything here in a block is good practice to avoid exposing arbitrary
   globals to other loaded mods. */
{
    const fs = nw.require("fs");

    const {generateUuid, addPackage, requestPackageName, promptYesNo, selectTargetPackage, selectTargetEvent} = require("./interactions.js");

    const mod = {};
    const eventDir = nw.App.dataPath + path.sep + "saveFiles" + path.sep + "customEvents" + path.sep;

    let currentCatalogue = {
        packages: [],
        unsorted: []
    };

    let customEvents = {
        version: Executive.game.version,
        events: []
    };

    let currentManager = null;

    const getPackageEnabledTotal = (package) => {
        /* To determine whether all package events are enabled or none are enabled, we
           need to be able to tally how many are enabled. */
        const eventsEnabled = package.events.filter(pkgEvent => {
            const eventObj = customEvents.events.find(candEvent => (candEvent.id === pkgEvent));
            return eventObj.eAllow;
        });

        return eventsEnabled.length;
    };

    const setPackageEnabled = (package, enabledState) => {
        package.events.forEach(evtId => {
            const eventObj = customEvents.events.find(candEvent => candEvent.id === evtId);
            eventObj.eAllow = enabledState;

            /* Update the event's toggle button. */
            const eventToggleButton = document.getElementById(evtId + "-toggle");
            eventToggleButton.setAttribute("class",
                enabledState ? "evtCmdrToggleButton enabled" : "evtCmdrToggleButton disabled");
            eventToggleButton.textContent = enabledState ? "Enabled" : "Disabled";
        });
    };

    const createListEntry = (package) => {
        /* Create the top-level list items in the event manager. */
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

        let updateEnabledDisabled = null;

        /* If it doesn't have a UUID, we know it's the fake unsorted events package. */
        if(package.uuid){
            /* Add the enable/disable buttons. */
            const enablePackageButton = document.createElement("button");
            rootDiv.append(enablePackageButton);

            const disablePackageButton = document.createElement("button");
            rootDiv.append(disablePackageButton);

            updateEnabledDisabled = () => {
                const totalEnabled = getPackageEnabledTotal(package);

                enablePackageButton.setAttribute("class", "evtCmdrRootToggle enable" +
                    ((totalEnabled === package.events.length) ? " allEnabled" : ""));
                enablePackageButton.textContent = (totalEnabled === package.events.length) ? "Enabled"
                    : "Enable";

                disablePackageButton.setAttribute("class", "evtCmdrRootToggle disable" +
                    ((totalEnabled === 0) ? " allDisabled" : ""));
                disablePackageButton.textContent = (totalEnabled === 0) ? "Disabled"
                    : "Disable";
            };

            updateEnabledDisabled();

            enablePackageButton.onclick = () => {
                playClick();
                setPackageEnabled(package, true);
                updateEnabledDisabled();
            };

            disablePackageButton.onclick = () => {
                playClick();
                setPackageEnabled(package, false);
                updateEnabledDisabled();
            };

            /* Add the remove package button. */
            const removePackageButton = document.createElement("button");
            removePackageButton.setAttribute("class", "evtCmdrItemRemove");
            removePackageButton.textContent = "–";
            rootDiv.append(removePackageButton);

            removePackageButton.addEventListener("click", async function(){
                playClick();

                const confirmResult = await promptYesNo("Confirm Package Removal",
                    `Are you sure you want to remove the ${package.name} package containing ${package.events.length} event${
                    (package.events.length !== 1) ? "s" : ""}?`);

                if(confirmResult){
                    entryDiv.remove();

                    package.events.forEach(event => {
                        const evtIndex = customEvents.events.indexOf(
                            customEvents.events.find(candEvent => (candEvent.id === event)));
                        customEvents.events.splice(evtIndex, 1);
                    });

                    currentCatalogue.packages.splice(currentCatalogue.packages.indexOf(package), 1);
                    
                    writeChanges();
                }
            });

            /* Add the share package button. */
            const sharePackageButton = document.createElement("button");
            sharePackageButton.setAttribute("class", "evtCmdrItemButton");
            rootDiv.append(sharePackageButton);

            const sharePackageIcon = document.createElement("i");
            sharePackageIcon.setAttribute("class", "evtCmdrShareIcon");
            sharePackageButton.append(sharePackageIcon);

            sharePackageButton.onclick = () => {
                playClick();

                /* We need to grey out the screen and open a save file dialog. */
                const backDiv = document.createElement("div");
                backDiv.setAttribute("class", "evtCmdrDialogBack");
                document.body.appendChild(backDiv);

                /* We need to create a hidden file input element. */
                const fileInput = document.createElement("input");
                fileInput.setAttribute("type", "file");
                fileInput.setAttribute("style", "display: none;");
                fileInput.setAttribute("accept", ".json");
                fileInput.toggleAttribute("nwsaveas");

                fileInput.addEventListener("cancel", () => {
                    backDiv.remove();
                });

                fileInput.addEventListener("change", () => {
                    if(fileInput.value === null) backDiv.remove();
                    else {
                        try {
                            const savePackage = {
                                version: package.version,
                                uuid: package.uuid,
                                name: package.name,
                                events: []
                            };

                            package.events.forEach(evtId => {
                                const eventObj = customEvents.events.find(candEvent => (candEvent.id === evtId));
                                savePackage.events.push(eventObj);
                            });

                            const packageText = JSON.stringify(savePackage);
                            fs.writeFileSync(fileInput.value, packageText);

                            backDiv.remove();
                        } catch {
                            backDiv.remove();
                            alertFunc("Failed to write the package file.");
                        }
                    }
                });

                fileInput.value = null;
                fileInput.click();
            };
        }

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

            /* Add the enable/disable button. */
            const eventToggleButton = document.createElement("button");
            eventToggleButton.setAttribute("id", evtId + "-toggle");
            eventToggleButton.setAttribute("class",
                (eventObj.eAllow) ? "evtCmdrToggleButton enabled" : "evtCmdrToggleButton disabled");
            eventToggleButton.textContent = (eventObj.eAllow) ? "Enabled" : "Disabled";
            eventHeaderDiv.appendChild(eventToggleButton);

            eventToggleButton.onclick = () => {
                playClick();
                eventObj.eAllow = !eventObj.eAllow;

                eventToggleButton.setAttribute("class",
                    (eventObj.eAllow) ? "evtCmdrToggleButton enabled" : "evtCmdrToggleButton disabled");
                eventToggleButton.textContent = (eventObj.eAllow) ? "Enabled" : "Disabled";

                if(updateEnabledDisabled) updateEnabledDisabled();
            };

            /* Add a remove button. */
            const removeButton = document.createElement("button");
            removeButton.setAttribute("class", "evtCmdrChildRemove");
            removeButton.textContent = "–";
            eventHeaderDiv.appendChild(removeButton);

            removeButton.onclick = () => {
                playClick();

                const eventPkgIndex = package.events.indexOf(eventObj.id);
                package.events.splice(eventPkgIndex, 1);

                const eventIndex = customEvents.events.indexOf(eventObj);
                customEvents.events.splice(eventIndex, 1);

                eventItemDiv.remove();
                packageLabelDiv.textContent = `${package.name} (${package.events.length} event${(package.events.length !== 1) ? "s" : ""})`;

                if(updateEnabledDisabled) updateEnabledDisabled();
            };

            /* Add a move package button. */
            const moveButton = document.createElement("button");
            moveButton.setAttribute("class", "evtCmdrChildButton");
            moveButton.textContent = "→";
            eventHeaderDiv.appendChild(moveButton);

            moveButton.onclick = () => {
                playClick();
                selectTargetPackage("Select New Package",
                    `Select a package to move the event ${evtId} to.`,
                    customEvents,
                    currentCatalogue,
                    (newPackage) => {
                        /* Now move the event. */
                        package.events.splice(package.events.indexOf(evtId), 1);

                        if(newPackage.uuid){
                            newPackage.events.push(evtId);
                        } else currentCatalogue.unsorted.push(evtId);

                        populateMgrList();
                        writeChanges();
                    }
                );
            };

            if(eventObj.devDesc !== ""){
                const eventDescDiv = document.createElement("div");
                eventDescDiv.setAttribute("class", "evtCmdrChildDesc");
                eventDescDiv.textContent = eventObj.devDesc;
                eventItemDiv.appendChild(eventDescDiv);
            }
        });

        return entryDiv;
    };

    const populateMgrList = () => {
        if(currentManager === null) return;

        /* Clear what's there first. */
        while(currentManager.listDiv.firstChild) currentManager.listDiv.lastChild.remove();

        currentCatalogue.packages.forEach(package => {
            currentManager.listDiv.appendChild(createListEntry(package));
        });

        /* Add a 'fake' package for unpackaged events. */
        currentManager.listDiv.appendChild(createListEntry({
            name: "Unpackaged Events",
            events: currentCatalogue.unsorted
        }));
    };
    
    mod.addEventManager = () => {
        if(currentManager !== null) return;

        /* Create the manager elements. */
        const backDiv = document.createElement("div");
        backDiv.setAttribute("id", "evtCmdrBackDiv");
        document.body.appendChild(backDiv);

        const mainDiv = document.createElement("div");
        mainDiv.setAttribute("id", "evtCmdrMainDiv");
        backDiv.appendChild(mainDiv);

        const titleHeader = document.createElement("h2");
        titleHeader.textContent = "Manage Custom Events";
        mainDiv.appendChild(titleHeader);
        mainDiv.appendChild(document.createElement("hr"));

        const closeButton = document.createElement("button");
        closeButton.setAttribute("class", "evtCmdrListClose");
        closeButton.textContent = "X";

        const closeManager = () => {
            playClick();
            backDiv.remove();
            currentManager = null;
        };

        closeButton.onclick = closeManager;

        mainDiv.appendChild(closeButton);

        /* Create the list itself. */
        const listDiv = document.createElement("div");
        listDiv.setAttribute("class", "evtCmdrListDiv");
        mainDiv.appendChild(listDiv);

        currentManager = {backDiv, mainDiv, titleHeader, closeButton, listDiv};

        /* Add buttons at the bottom. */
        const controlDiv = document.createElement("div");
        controlDiv.setAttribute("id", "evtCmdrControlDiv");
        mainDiv.appendChild(controlDiv);
        
        const addPackageButton = document.createElement("button");
        addPackageButton.setAttribute("class", "evtCmdrControlButton");
        addPackageButton.textContent = "Add Event Package";
        controlDiv.appendChild(addPackageButton);

        /* To allow us to wait for modal dialogs to close, interaction code will call async functions. */
        async function addClickHandler(){
            playClick();
            addPackage(customEvents, currentCatalogue, () => {
                writeChanges();
                populateMgrList();
            });
        }

        addPackageButton.onclick = () => {
            addClickHandler();
        };

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

            populateMgrList();
            writeChanges();
        }

        newPackageButton.onclick = () => {
            newClickHandler();
        };

        const okayButton = document.createElement("button");
        okayButton.setAttribute("class", "evtCmdrControlButton");
        okayButton.textContent = "OK";
        controlDiv.appendChild(okayButton);

        okayButton.onclick = () => {
            writeChanges();
            closeManager();
        };

        const cancelButton = document.createElement("button");
        cancelButton.setAttribute("class", "evtCmdrControlButton");
        cancelButton.textContent = "Cancel";
        cancelButton.onclick = closeManager;
        controlDiv.appendChild(cancelButton);

        /* Finally, fill the list. */
        populateMgrList();
    };

    mod.addEditEventSelection = () => {
        selectTargetEvent("Edit Custom Events",
            "Select an event to open in the event editor.",
            customEvents,
            currentCatalogue,
            (targetEventId) => {
                /* We have to invoke the game's editor ourselves with the event object targeted. */
                const eventObj = customEvents.events.find(candEvent => (candEvent.id === targetEventId));
                createCustomEvents(eventObj, "customEventDiv");
            }
        );
    };

    const checkMissingEvents = () => {
        /* We check every custom event to make sure it's contained within a package.
           If not, it gets dumped in the unsorted section. */
        customEvents.events.forEach(event => {
            const trimmedPackages = currentCatalogue.packages.filter(package => package.events.includes(event.id));
            if(trimmedPackages.length === 0){
                if(!currentCatalogue.unsorted.includes(event.id)){
                    currentCatalogue.unsorted.push(event.id);
                }
            }
        });

        /* Next, we need to check if any events contained in the catalogue no longer
           exist so that we can prune them. */
        currentCatalogue.packages.forEach(package => {
            let cullingList = package.events.filter(event1 => (customEvents.events.filter(event2 => (event2.id === event1)).length === 0));
            package.events = package.events.filter(event => !cullingList.includes(event));
        });

        let cullingList = currentCatalogue.unsorted.filter(event1 => (customEvents.events.filter(event2 => (event2.id === event1)).length === 0));
        currentCatalogue.unsorted = currentCatalogue.unsorted.filter(event => !cullingList.includes(event));
    };

    const writeChanges = () => {
        fs.writeFileSync(eventDir + "eventsCatalogue.json", JSON.stringify(currentCatalogue));
        fs.writeFileSync(eventDir + "customEvents.json", JSON.stringify(customEvents));
    };

    const getButtonByContents = (buttonContents) => [...document.querySelectorAll("button")].filter(btn => (btn.textContent === buttonContents))[0];

    /* We need a replacement function to update our internal state whenever an event is created/updated in
       the event creator. */
    const updateNewEvent = (newEvent, exitEditor) => {
        const oldEvent = customEvents.events.find(candEvent => (candEvent.id === newEvent.id));

        /* The game may want us to close the editor. */
        if(exitEditor){
            const editorDiv = document.getElementById("customEventDiv");
            if(editorDiv) editorDiv.remove();
            customEventMenu();
        }

        /* Check if an event with the ID already exists. */
        if(oldEvent){
            /* We need to prompt the player, so we drop into an async context. */
            (async () => {
                const overwriteSelection = await promptYesNo("Overwrite Event",
                    `An event with the ID ${newEvent.id} already exists. Would you like to overwrite it?`
                );
                if(overwriteSelection){
                    customEvents.events[customEvents.events.indexOf(oldEvent)] = newEvent;
                    writeChanges();
                }
            })();
        } else {
            /* We prompt the player to select a package to put the event in. */
            selectTargetPackage("Select a Package",
                `Select a package to contain the new event (${newEvent.id}).`,
                customEvents,
                currentCatalogue,
                (newPackage) => {
                    /* Now insert the event. */
                    customEvents.events.push(newEvent);
                    newPackage.events.push(newEvent.id);
                },
                true,
                writeChanges
            );
        }
    };

    mod.init = () => {
        /* Check if the event catalogue already exists. */
        if(fs.existsSync(eventDir + "eventsCatalogue.json")){
            const catalogueText = fs.readFileSync(eventDir + "eventsCatalogue.json");
            currentCatalogue = JSON.parse(catalogueText);
        }

        /* Now try to load the custom events file. */
        try {
            const eventsText = fs.readFileSync(eventDir + "customEvents.json");
            customEvents.events = JSON.parse(eventsText).events;
        } catch {
            console.warn("[Event Commmander] Couldn't load custom event array from customEvents.json.");
        }

        /* Make sure we don't have any loose events. */
        checkMissingEvents();
        writeChanges();

        /* Modify the custom event tool menu whenever it's created. */
        Executive.functions.registerPostHook("customEventMenu", () => {
            /* We'll be changing the Active/Inactive Events button. */
            const manageEventsButton = getButtonByContents("Active/Inactive Events");
            if(manageEventsButton) manageEventsButton.textContent = "Manage Events";

            /* We want to remove the existing Import/Export buttons. They're not actually necessary
               any more and they mess with integrity of internal data structures. */
            const importButton = getButtonByContents("Import Event(s)");
            if(importButton) importButton.remove();

            const exportButton = getButtonByContents("Export Event(s)");
            if(exportButton) exportButton.remove();

            /* We replace the event handler with our own. This makes stuff to do with
               keeping the Custom Event Tool menu open a lot easier. */
            manageEventsButton.onclick = () => {
                playClick();
                mod.addEventManager();
            };

            /* We'll also update the Load/Edit Event button. */
            const editButton = getButtonByContents("Load/Edit Event");
            if(editButton) editButton.textContent = "Edit Events";

            editButton.onclick = () => {
                playClick();
                mod.addEditEventSelection();
            };
        });

        /* Replace the functions that open menus. This ensures that any other mod opening
           a given menu will open our menu instead. */
        Executive.functions.registerReplacement("activeCustomEvents", mod.addEventManager);
        Executive.functions.registerReplacement("loadCustomEvents", mod.addEditEventSelection);

        /* We need to replace the game's default behaviour for saving a custom event. */
        Executive.functions.registerReplacement("saveCustomEvent", updateNewEvent);

        /* Add the stylesheets for UI components. */
        Executive.styles.registerStyle("styles/general.css");
        Executive.styles.registerThemeAwareStyle("styles/light.css", "styles/dark.css");
    };

    module.exports = mod;
}