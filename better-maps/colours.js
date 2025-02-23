/* Better Election Maps – better-maps/colours.js
   Functions for handling party colours. */

{
    /* Load the mod configuration file. */
    const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
    const config = JSON.parse(configText);

    module.exports = {
        getCandidateColour: (cand) => {
            return ((cand.party !== "I") ? config.partyColours[cand.party] :
                config.partyColours.I[cand.caucus]);
        },
        getPoliticianColour: (pol) => {
            return ((pol.extendedAttribs.party !== "Independent") ? config.partyColours[pol.caucusParty.charAt(0)] :
                config.partyColours.I[pol.caucusParty.charAt(0)]);
        },
        stringifyColour: (col) => {
            return `hsl(${col.h}, ${col.s}%, ${col.l}%)`;
        }
    };
};