# Xoraurea's Mods for The Political Process

Here are the mods I've written for The Political Process. The mods in this repository require the installation of the Executive mod loader – if you don't have it installed, grab it [here](https://github.com/Xoraurea/tpp-executive) before continuing. All three mods are fully independent of each other, and can be mixed and matched.

All of my mods are currently in beta – please report any bugs you discover!

## Better Election Maps

**Better Election Maps** is a mod designed to enhance The Political Process' in-game election maps by rewriting the renderer to use SVG-based maps with enhanced tooltips instead of the game's default HTML5-based maps. To use the mod, simply copy the folder to your `modFiles` directory.

### Features

- **Smoother maps!** The improved maps are smoother to interact with and hover over.
- **Dark mode support!** The mod's maps fully support dark mode in the background of the maps and in tooltips.
- **Custom party colours!** You can define whatever colours you prefer for Democrats, Republicans, Independent Democrats and Independent Republicans in the mod's `config.json` file.
- **More visible independents!** Distinct colours are now used to represent Independent Democrats and Independent Republicans. The Politicians tab also now shows states with mixed D-I or R-I delegations distinctly.
- **Party demographics in the Elections tab!** Instead of just being displayed in the Politicians tab, clicking on a state in the Elections tab will now let you see the party identification demographics in that state.

### Planned Features

- Support for county-level views.
- A live tracker of races which have been called on election nights.

### Configuration

Colours for each type of politician are expressed as HSL values in `config.json`. Colours for Democrats and Republicans are picked from `D` and `R` under `partyColours`, while colours for Independent Democrats and Independent Republicans are picked from `D` and `R` under `I`.

`showPanePartyID` adjusts whether the mod adds party identification demographics to the side pane under the Elections tab.

## Event Commander

**Event Commander** overhauls The Political Process' Custom Event Tool, which allows players to add, enable and disable custom events within the game. Event Commander's primary feature is allowing the grouping of individual events into *packages*, which may be enabled and disabled all at once. Existing bundles of events exported by the vanilla game can be imported as usual, as long as you give them a name. Packages exported with Event Commander installed can also be imported into the vanilla game.

To start using Event Commander, just copy the mod folder into your `modFiles` directory.

### Features

- **Bundle events!** With Event Commander, custom events can now be grouped together into bundles called packages.
- **Toggle packages!** Instead of having to enable or disable every event, you can enable or disable every event in a package with one click.
- **Create new packages!** Event creators can easily create new empty packages with a single button and add their events to them.
- **Import/export packages anywhere!** Packages of events no longer have to be saved to or loaded from the desktop – importing or exporting a package will open a file dialog which lets you navigate to anywhere on your computer.
- **Compatibility with the vanilla game!** Any bundles of events exported by the vanilla game can be imported by Event Commander, and any packages exported by Event Commander can be imported by the vanilla game.

### Guide

Once you install Event Commander for the first time, every custom event you've previously imported will be grouped together under the Unpackaged Events umbrella. From the main menu, clicking through Tools, Custom Event Tool and Manage Events will take you to Event Commander's main interface. From here, you can add a package of events by simply clicking the Add Event Package button and selecting a JSON file on your computer.

You can also re-group existing events. The Create New Package button will allow you to name and create a new, empty package. This can then be populated by expanding the Unpackaged Events group and clicking the → button next to the event you want to move. This will bring up a dialog allowing you to select a new package to place the event in. Similarly, saving a new event you're editing will bring up the same dialog, with an option to also create a new package.

You can also export a package you've created. To export a package, click the button featuring the share icon next to the package of your choice, and select a location to save the file in. This package file can now be shared and imported by others while preserving the name you've given the package.

### Planned Features

- An overhauled interface for creating new events.
- A dialog to rename packages.

## Party Shifts

**Party Shifts** is a mod allowing for dynamic shifts in party identification within each state. At the end of every year, the mod determines which party has the highest overall bipartisan approval and shifts party identification within that state in that party's direction.

This mod is very experimental – unless you're willing to have almost every state invariably shift dramatically towards the Democrats in your game, I don't recommend installing this in its current state. If you'd rather not heed my warnings, you can install the mod by simply copying its folder over to the `modFiles` directory.

### Planned Features

- Greater balance in party shifts.
- Configuration options for the size of shifts each year.