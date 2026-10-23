// Explicit allow-list. Adding a publisher requires an editorial review and a code change.
export const officialDomains = [
  "insee.fr",
  "drees.solidarites-sante.gouv.fr",
  "service-public.gouv.fr",
  "service-public.fr",
  "legifrance.gouv.fr",
  "assemblee-nationale.fr",
  "senat.fr",
  "vie-publique.fr",
  "economie.gouv.fr",
  "impots.gouv.fr",
  "douane.gouv.fr",
  "travail-emploi.gouv.fr",
  "cor-retraites.fr",
  "conseil-constitutionnel.fr",
  "conseil-etat.fr",
  "courdecassation.fr",
  "ccomptes.fr",
  "cnil.fr",
  "education.gouv.fr",
  "interieur.gouv.fr",
  "justice.gouv.fr",
  "sante.gouv.fr",
  "ecologie.gouv.fr",
  "ademe.fr",
  "banque-france.fr",
  "ec.europa.eu",
  "europarl.europa.eu",
  "consilium.europa.eu",
  "ofpra.gouv.fr",
  "ofii.fr",
  "unhcr.org",
  "oecd.org",
  "ameli.fr",
  "caf.fr",
  "urssaf.fr",
  "info-retraite.fr",
  "francetravail.fr",
  "unedic.org",
  "commission-des-sondages.fr",
];
export function isOfficialSource(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      officialDomains.some(
        (d) => url.hostname === d || url.hostname.endsWith("." + d),
      )
    );
  } catch {
    return false;
  }
}
