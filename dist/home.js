// Keep links previously shared from the investigation functional.
const investigationAnchors = new Set(['vies','facture','comparaison','peines','sources','journal','registre','human-cases']);
function routeLegacyAnchor(){ if(investigationAnchors.has(location.hash.slice(1))) location.replace('/enquetes/le-prix-du-refus/'+location.hash); }
routeLegacyAnchor(); window.addEventListener('hashchange',routeLegacyAnchor);
