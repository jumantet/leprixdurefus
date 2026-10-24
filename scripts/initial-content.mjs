// Initial reviewed batch. Other agreed outlines remain drafts, never fabricated corrections.
import { readFileSync, writeFileSync } from "node:fs";
const cat = JSON.parse(
  readFileSync(new URL("../content/catalog.json", import.meta.url)),
);
const S = (publisher, title, url) => ({
  publisher,
  title,
  url,
  checkedAt: "2026-10-23",
});
const src = {
  budget: S(
    "Insee",
    "Les dépenses publiques par fonction en 2024",
    "https://www.insee.fr/fr/statistiques/8735252",
  ),
  deficit: S(
    "Insee",
    "Le compte des administrations publiques en 2025",
    "https://www.insee.fr/fr/statistiques/8997691",
  ),
  tva: S(
    "Direction générale des douanes",
    "Taxe sur la valeur ajoutée",
    "https://www.douane.gouv.fr/lexique/taxe-sur-la-valeur-ajoutee-tva",
  ),
  taux: S(
    "Ministère de l’Économie",
    "TVA : les taux du quotidien",
    "https://www.economie.gouv.fr/particuliers/impots-et-fiscalite/gerer-mes-autres-impots-et-taxes/tva-quels-sont-les-taux-de-votre-quotidien",
  ),
  ir: S(
    "Service Public",
    "Calcul de l’impôt sur le revenu",
    "https://www.service-public.gouv.fr/particuliers/vosdroits/F34328",
  ),
  patrimoine: S(
    "Insee",
    "Patrimoine net des ménages",
    "https://www.insee.fr/fr/statistiques/5371259?sommaire=5371304",
  ),
  dividende: S(
    "Ministère de l’Économie",
    "Dictionnaire de l’économie : action et dividendes",
    "https://www.economie.gouv.fr/facileco/dico-de-leco",
  ),
  chomage: S(
    "Insee",
    "Chômeur au sens du BIT",
    "https://www.insee.fr/fr/metadonnees/definition/c1129",
  ),
  retraite: S(
    "Ministère du Travail",
    "Le système et les régimes de retraite",
    "https://travail-emploi.gouv.fr/retraite",
  ),
  reserve: S(
    "Conseil d’orientation des retraites",
    "Répartition, réserves et capitalisation",
    "https://www.cor-retraites.fr/reunions-du-cor/repartition-reserves-capitalisation-quels-enjeux-pour-retraites",
  ),
  immigre: S(
    "Insee",
    "Définition : immigré",
    "https://www.insee.fr/fr/metadonnees/definition/c1328",
  ),
  etranger: S(
    "Insee",
    "Définition : étranger",
    "https://www.insee.fr/fr/metadonnees/definition/c1198",
  ),
  blanc: S(
    "Vie publique — DILA",
    "Vote blanc, vote nul : quelles différences ?",
    "https://www.vie-publique.fr/fiches/23931-vote-blanc-vote-nul-quelles-differences",
  ),
  vote: S(
    "Ministère de l’Intérieur",
    "Qu’est-ce que le vote blanc ?",
    "https://www.interieur.gouv.fr/archive/qu-est-ce-que-le-vote-blanc",
  ),
};
const published = {};
function quiz(n, intro, rows) {
  const id = "q" + String(n).padStart(3, "0");
  const title = cat.quizzes.find((q) => q.id === id).title;
  published[id] = {
    title,
    intro,
    questions: rows.map(([prompt, options, explanation, nuance, keys], i) => {
      const correct = options[0];
      const shift = (n + i) % 4;
      const order = options.slice(shift).concat(options.slice(0, shift));
      return {
        id: `${id}-${i + 1}`,
        prompt,
        choices: order.map((text, j) => ({ id: "abcd"[j], text })),
        correctChoiceId: "abcd"[order.indexOf(correct)],
        explanation,
        nuance,
        sources: keys.map((k) => src[k]),
      };
    }),
  };
}
quiz(
  11,
  "Avant de comparer les montants, distinguons les aides sous condition de ressources et l’ensemble de la protection sociale. Données françaises de 2024.",
  [
    [
      "Dans la classification de l’Insee utilisée ici, quelle dépense relève de la protection sociale ?",
      [
        "Les pensions de retraite",
        "L’achat de matériel militaire",
        "La construction des tribunaux",
        "L’entretien des ambassades",
      ],
      "Les pensions de retraite appartiennent aux dépenses de protection sociale. Cette catégorie dépasse donc les seules aides destinées aux ménages sans emploi.",
      "Le mot « allocations » est trop imprécis pour désigner tout ce périmètre.",
      ["budget"],
    ],
    [
      "En 2024, quelle fonction représente la plus grande part des dépenses publiques dans cette publication ?",
      [
        "La protection sociale, hors santé",
        "La défense",
        "L’enseignement",
        "La protection de l’environnement",
      ],
      "La protection sociale hors santé représente environ 41 % du total en 2024, devant la santé. Le classement porte sur des fonctions de dépense.",
      "Ce résultat ne signifie pas que les minima sociaux représentent 41 % des dépenses.",
      ["budget"],
    ],
    [
      "Pourquoi ne peut-on pas attribuer les 693 milliards d’euros de protection sociale au seul RSA ?",
      [
        "Ce montant regroupe plusieurs risques et prestations, dont les retraites",
        "Le RSA représente exactement toutes les retraites",
        "Ce montant est le budget militaire",
        "L’Insee ne compte aucune prestation",
      ],
      "Les 693 milliards couvrent un ensemble de dépenses sociales. Les attribuer à une seule allocation change le sens du chiffre.",
      "Pour comparer une prestation précise, il faut son propre montant et la même année de référence.",
      ["budget"],
    ],
  ],
);
quiz(
  14,
  "Trois petits raisonnements pour distinguer recettes, dépenses et déficit. Les exemples chiffrés sont fictifs.",
  [
    [
      "Un budget dépense 100 et reçoit 90. Quel est son déficit ?",
      ["10", "90", "100", "190"],
      "Le déficit de cet exemple est la différence entre dépenses et recettes : 100 − 90 = 10.",
      "Ce calcul simplifié décrit un solde annuel, pas le montant total de dette.",
      ["deficit"],
    ],
    [
      "Les dépenses restent à 100, mais les recettes passent de 90 à 85. Que devient le déficit ?",
      [
        "Il augmente de 10 à 15",
        "Il reste à 10",
        "Il diminue à 5",
        "Il devient un excédent de 15",
      ],
      "À dépenses inchangées, une diminution des recettes augmente ici le déficit : 100 − 85 = 15.",
      "Cet exemple ne mesure pas les effets économiques indirects d’une réforme fiscale.",
      ["deficit"],
    ],
    [
      "Quelle information faut-il examiner pour expliquer l’évolution du solde public ?",
      [
        "L’évolution des recettes et des dépenses sur la même période",
        "Uniquement le total des dépenses",
        "Uniquement le nom du gouvernement",
        "Uniquement la dette à une date",
      ],
      "Un solde dépend des deux côtés du budget. L’Insee analyse conjointement leurs évolutions pour expliquer les résultats annuels.",
      "Cette décomposition comptable ne suffit pas à attribuer toutes les causes à une seule décision.",
      ["deficit"],
    ],
  ],
);
quiz(
  16,
  "« Non imposable » ne veut pas dire « aucun impôt ». Commençons par préciser le prélèvement dont on parle.",
  [
    [
      "Dans l’expression courante « ménage non imposable », quel impôt est généralement visé ?",
      [
        "L’impôt sur le revenu",
        "Tous les impôts possibles",
        "Uniquement la TVA",
        "Uniquement les droits de douane",
      ],
      "L’expression renvoie généralement à l’impôt sur le revenu. Elle ne signifie pas que le ménage ne supporte aucun autre impôt.",
      "Une statistique de foyers fiscaux n’est pas automatiquement une statistique de personnes.",
      ["ir"],
    ],
    [
      "Un consommateur non imposable sur le revenu achète un produit soumis à la TVA. La TVA disparaît-elle ?",
      [
        "Non, elle reste incluse dans le prix de cet achat",
        "Oui, automatiquement à la caisse",
        "Oui, si le paiement est en espèces",
        "Oui, pour tous les achats alimentaires",
      ],
      "La TVA est liée à l’opération de consommation concernée. L’absence d’impôt sur le revenu ne l’efface pas.",
      "Certains produits ou opérations bénéficient de taux spécifiques ou d’exonérations.",
      ["tva"],
    ],
    [
      "Que faut-il vérifier avant d’utiliser la phrase « la moitié ne paie pas d’impôt » ?",
      [
        "L’impôt concerné, l’année et la population comptée",
        "Uniquement la couleur du graphique",
        "Le montant du plus gros salaire",
        "Le nombre de magasins du pays",
      ],
      "Un chiffre n’est interprétable que si son périmètre est explicite. Les règles de l’impôt sur le revenu et celles de la TVA portent sur des bases différentes.",
      "Ce parcours ne valide aucun pourcentage : il examine la confusion entre un impôt et tous les impôts.",
      ["ir", "tva"],
    ],
  ],
);
quiz(
  17,
  "Comprendre le principe des tranches sans le confondre avec les conditions d’attribution d’une aide.",
  [
    [
      "À quoi s’applique le taux marginal de l’impôt sur le revenu ?",
      [
        "À la tranche la plus élevée atteinte, pas à tout le revenu",
        "À tout le patrimoine",
        "À tous les revenus depuis la naissance",
        "Au salaire de tous les membres de la famille sans distinction",
      ],
      "Le barème est progressif par tranches. Atteindre une tranche supérieure ne fait pas passer les tranches inférieures au nouveau taux.",
      "Le calcul complet dépend aussi des parts, déductions et autres mécanismes fiscaux.",
      ["ir"],
    ],
    [
      "Exemple simplifié : 100 € supplémentaires sont intégralement dans une tranche à 30 %. Quel impôt supplémentaire produit ce seul mécanisme ?",
      ["30 €", "300 €", "100 €", "Tout le salaire annuel à 30 %"],
      "Dans cet exemple, 100 × 30 % = 30 €. Les 70 € restants ne disparaissent pas à cause du seul barème.",
      "On isole ici le barème : aucune cotisation ou modification de prestation n’est simulée.",
      ["ir"],
    ],
    [
      "Taux moyen et taux marginal désignent-ils la même chose ?",
      [
        "Non : le premier rapporte l’impôt au revenu, le second concerne la dernière tranche",
        "Oui, toujours",
        "Le premier ne concerne que les entreprises",
        "Le second est une taxe locale",
      ],
      "Le taux moyen résume la part du revenu consacrée à cet impôt. Il peut être inférieur au taux de la dernière tranche.",
      "Le taux de prélèvement à la source est encore une autre notion de calcul.",
      ["ir"],
    ],
  ],
);
quiz(
  19,
  "Examinons le taux appliqué à un achat et l’effort qu’il représente pour différents budgets.",
  [
    [
      "Tous les produits ont-ils le même taux de TVA en France métropolitaine ?",
      [
        "Non, plusieurs taux et des exonérations existent",
        "Oui, tous à 20 % sans exception",
        "Oui, tous à 5,5 %",
        "Les taux dépendent uniquement du salaire de l’acheteur",
      ],
      "Il existe un taux normal et des taux particuliers ou réduits selon les opérations. Un taux unique pour tous les produits n’est donc pas la règle.",
      "Les règles peuvent aussi varier selon le territoire et la date.",
      ["taux"],
    ],
    [
      "Deux personnes paient chacune 20 € de TVA. Leurs revenus sont 1 000 € et 4 000 €. Quelles parts de revenu cela représente-t-il ?",
      ["2 % et 0,5 %", "2 % et 2 %", "20 % et 40 %", "0,5 % et 2 %"],
      "Le calcul est 20/1 000 et 20/4 000. Une même somme ne représente pas le même effort relatif.",
      "C’est un exemple arithmétique fictif, pas une estimation de leur consommation réelle.",
      ["taux"],
    ],
    [
      "Le fait qu’un taux soit identique suffit-il à conclure que l’impôt est juste ?",
      [
        "Non : il faut préciser les critères de justice utilisés",
        "Oui, c’est une identité mathématique",
        "Oui, cela prouve que tous ont le même revenu",
        "Non, cela prouve que tous les taux doivent être supprimés",
      ],
      "Le taux décrit une règle de prélèvement. Juger sa justice exige de préciser le critère : montant, part du revenu ou effets de redistribution, par exemple.",
      "Les sources établissent les règles ; elles ne décident pas à ta place du critère de justice.",
      ["taux"],
    ],
  ],
);
quiz(
  22,
  "Revenu, patrimoine brut, patrimoine net : trois mesures qu’on ne peut pas utiliser indifféremment.",
  [
    [
      "Une maison détenue et un salaire mensuel mesurent-ils la même chose ?",
      [
        "Non : un actif détenu et un flux de revenu",
        "Oui, ce sont deux salaires",
        "Oui, uniquement si la maison est louée",
        "Non : une maison ne peut jamais être un patrimoine",
      ],
      "Le patrimoine correspond à des actifs détenus à une date. Le revenu se mesure sur une période.",
      "Un actif peut aussi générer un revenu, mais sa valeur et ce revenu restent distincts.",
      ["patrimoine"],
    ],
    [
      "Exemple : un logement vaut 200 000 € et il reste 150 000 € d’emprunt. Quel est le patrimoine net associé, sans autre actif ni dette ?",
      ["50 000 €", "200 000 €", "350 000 €", "150 000 €"],
      "Le patrimoine net retranche les dettes des actifs : 200 000 − 150 000 = 50 000 €.",
      "Ce calcul simplifié ignore les coûts de vente et une éventuelle variation de valeur.",
      ["patrimoine"],
    ],
    [
      "Que signifie un patrimoine médian de 100 000 € dans un exemple fictif ?",
      [
        "La moitié des ménages est en dessous et la moitié au-dessus",
        "Tous les ménages possèdent 100 000 €",
        "Le ménage le plus riche possède 100 000 €",
        "Le revenu moyen vaut 100 000 €",
      ],
      "La médiane sépare la distribution en deux moitiés. Elle ne doit pas être confondue avec la moyenne.",
      "Une même médiane peut coexister avec des répartitions très différentes au sommet.",
      ["patrimoine"],
    ],
  ],
);
quiz(
  29,
  "Distinguer rémunération du travail et distribution aux détenteurs du capital.",
  [
    [
      "À quel titre reçoit-on un dividende ?",
      [
        "Comme détenteur d’une part du capital concerné",
        "Automatiquement comme salarié",
        "Comme client fidèle",
        "Comme demandeur d’emploi",
      ],
      "Le dividende est une distribution aux associés ou actionnaires. Il est lié à la détention du capital.",
      "Tous les salariés ne détiennent pas des actions de leur employeur.",
      ["dividende"],
    ],
    [
      "Un salarié possède aussi des actions de son entreprise. Peut-il recevoir des dividendes ?",
      [
        "Oui, en sa qualité d’actionnaire si une distribution intervient",
        "Non, le salariat interdit les actions",
        "Oui, mais son salaire devient alors un dividende",
        "Oui, même si aucune distribution n’est décidée",
      ],
      "La même personne peut être salariée et actionnaire. Ses revenus relèvent alors de deux qualités distinctes.",
      "Détenir une action ne garantit pas un dividende à chaque exercice.",
      ["dividende"],
    ],
    [
      "Quelle comparaison évite de confondre salaire et dividende ?",
      [
        "Identifier ce qui rémunère le travail et ce qui revient au capital",
        "Additionner tous les versements sous le mot salaire",
        "Appeler dividende toute prime",
        "Comparer seulement les intitulés bancaires",
      ],
      "Le salaire rémunère le travail salarié ; le dividende est attaché au capital détenu. Le destinataire peut parfois être la même personne.",
      "Cette distinction ne tranche pas le débat sur le partage de la valeur.",
      ["dividende"],
    ],
  ],
);
quiz(
  31,
  "Avant de discuter des comportements, regardons ce que mesure réellement le chômage au sens du BIT.",
  [
    [
      "Quelle combinaison correspond à la définition statistique du chômage au sens du BIT ?",
      [
        "Sans emploi, disponible et en recherche active, ou emploi déjà trouvé débutant prochainement",
        "Toute personne qui ne travaille pas, sans autre condition",
        "Uniquement les personnes indemnisées",
        "Toutes les personnes de plus de 60 ans",
      ],
      "La définition combine l’absence d’emploi, la disponibilité et la recherche, avec le cas d’un emploi déjà trouvé qui commence prochainement.",
      "Il s’agit d’une définition statistique, pas d’une évaluation morale.",
      ["chomage"],
    ],
    [
      "Faut-il obligatoirement recevoir une allocation pour être chômeur au sens du BIT ?",
      [
        "Non, l’indemnisation ne fait pas partie de ces critères",
        "Oui, toujours",
        "Oui, au moins le SMIC",
        "Uniquement en fin d’année",
      ],
      "Les critères du BIT ne comportent pas de condition de versement d’une allocation.",
      "Les droits à indemnisation suivent des règles distinctes.",
      ["chomage"],
    ],
    [
      "Une personne sans emploi mais indisponible pour travailler immédiatement est-elle automatiquement comptée au chômage BIT ?",
      [
        "Non, la disponibilité fait partie des conditions",
        "Oui, toute absence d’emploi suffit",
        "Oui, si elle possède un diplôme",
        "Non, uniquement à cause de son âge",
      ],
      "La définition demande une disponibilité pour prendre un emploi dans les deux semaines. L’absence d’emploi seule ne suffit pas.",
      "Ne pas être classé au chômage BIT ne signifie pas forcément ne pas souhaiter travailler.",
      ["chomage"],
    ],
  ],
);
quiz(
  36,
  "Comprendre ce que financent les cotisations et ce que représentent les droits acquis.",
  [
    [
      "Dans un régime par répartition, les cotisations actuelles servent principalement à quoi ?",
      [
        "Payer les pensions actuelles",
        "Remplir un compte personnel bloqué au nom de chaque cotisant",
        "Acheter automatiquement un logement à chaque retraité",
        "Rembourser uniquement la dette militaire",
      ],
      "La répartition organise un transfert des actifs vers les retraités actuels. Les cotisants acquièrent des droits pour leur propre retraite.",
      "Acquérir des droits n’est pas identique à mettre chaque euro sur un compte personnel.",
      ["retraite"],
    ],
    [
      "Quel énoncé décrit le mieux les droits à retraite ?",
      [
        "Des droits calculés selon les règles du régime",
        "Une cagnotte individuelle contenant exactement toutes les cotisations",
        "Une promesse de récupérer exactement le même nombre d’euros",
        "Un placement garanti identique pour tous",
      ],
      "Les pensions sont calculées selon les règles applicables, notamment la carrière et les revenus. Les droits ne sont pas un simple solde bancaire personnel.",
      "Le système comporte aussi des mécanismes de solidarité.",
      ["retraite"],
    ],
    [
      "Un régime par répartition peut-il disposer de réserves financières ?",
      [
        "Oui, des réserves peuvent compléter son fonctionnement",
        "Non, c’est impossible par définition",
        "Oui, donc il devient forcément entièrement par capitalisation",
        "Non, aucune caisse ne peut détenir d’actifs",
      ],
      "Le COR documente les réserves de plusieurs régimes par répartition. Leur existence peut aider à lisser des déséquilibres dans le temps.",
      "Réserves collectives et épargne individuelle en capitalisation ne sont pas équivalentes.",
      ["reserve"],
    ],
  ],
);
quiz(
  42,
  "Deux catégories souvent confondues. Les définitions utilisées ici sont celles de l’Insee.",
  [
    [
      "Selon l’Insee, une personne immigrée résidant en France est une personne…",
      [
        "Née étrangère à l’étranger",
        "Née en France de parents étrangers",
        "Qui ne parle pas français",
        "Qui voyage à l’étranger",
      ],
      "La définition combine le lieu de naissance à l’étranger et la nationalité étrangère à la naissance.",
      "Elle ne dépend pas de la langue parlée ni des convictions de la personne.",
      ["immigre"],
    ],
    [
      "Une personne née étrangère à l’étranger et devenue française reste-t-elle immigrée au sens statistique ?",
      [
        "Oui",
        "Non, elle ne l’a jamais été",
        "Uniquement si elle possède deux passeports",
        "Uniquement si elle vit à Paris",
      ],
      "L’acquisition de la nationalité française ne modifie pas le lieu et la nationalité de naissance. Elle reste donc immigrée au sens de cette définition.",
      "Elle n’est plus étrangère si elle possède la nationalité française.",
      ["immigre", "etranger"],
    ],
    [
      "Une personne née en France peut-elle être étrangère sans être immigrée ?",
      [
        "Oui",
        "Non, ces catégories sont identiques",
        "Seulement après 80 ans",
        "Seulement si elle travaille à l’étranger",
      ],
      "Une personne résidant en France sans nationalité française peut être née en France. Elle est alors étrangère mais ne répond pas à la définition d’immigré.",
      "Les règles d’acquisition de la nationalité constituent un autre sujet.",
      ["etranger"],
    ],
  ],
);
quiz(
  96,
  "Comprendre comment les bulletins sont classés et comment les résultats sont calculés.",
  [
    [
      "Une enveloppe vide déposée dans l’urne correspond à quel type de vote ?",
      [
        "Un vote blanc",
        "Un vote pour le candidat arrivé premier",
        "Une abstention",
        "Un vote pour tous les candidats",
      ],
      "L’enveloppe vide est comptabilisée comme vote blanc. Elle marque une participation sans choix d’un candidat.",
      "Ce quiz décrit les règles françaises exposées par la DILA.",
      ["blanc"],
    ],
    [
      "Les votes blancs entrent-ils dans les suffrages exprimés ?",
      [
        "Non",
        "Oui, au bénéfice du gagnant",
        "Oui, divisés entre les candidats",
        "Oui, uniquement au second tour",
      ],
      "Ils sont comptés séparément, mais ne font pas partie des suffrages exprimés utilisés pour les pourcentages des candidats.",
      "Être décompté ne signifie donc pas être inclus dans ce dénominateur.",
      ["blanc"],
    ],
    [
      "Quelle différence entre vote blanc et abstention ?",
      [
        "Voter blanc implique de participer au vote ; s’abstenir signifie ne pas voter",
        "Aucune, ils sont classés ensemble",
        "Le vote blanc vaut deux abstentions",
        "L’abstention est attribuée à un candidat",
      ],
      "Le vote blanc et l’abstention correspondent à deux comportements et deux catégories distincts.",
      "On ne peut pas déduire les motivations individuelles de ces seules catégories.",
      ["blanc"],
    ],
  ],
);
quiz(
  99,
  "Un pourcentage ne signifie rien sans sa population de référence. Exercices fictifs, pas résultats d’une élection réelle.",
  [
    [
      "Dans « 30 % des suffrages exprimés », quel est le dénominateur ?",
      [
        "Les suffrages exprimés, pas toute la population",
        "Tous les habitants, enfants compris",
        "Tous les abstentionnistes",
        "Tous les inscrits, automatiquement",
      ],
      "Le pourcentage se rapporte aux suffrages exprimés. Les votes blancs et nuls n’y sont pas inclus.",
      "Les personnes non inscrites ne figurent pas non plus dans ce dénominateur.",
      ["vote"],
    ],
    [
      "Sur 1 000 inscrits, 600 suffrages sont exprimés. Un candidat en obtient 180. Quelle part des inscrits cela représente-t-il ?",
      ["18 %", "30 %", "60 %", "180 %"],
      "180 divisé par 1 000 donne 18 %. Le même candidat a 30 % des 600 suffrages exprimés.",
      "Exemple arithmétique fictif : les deux pourcentages répondent à des questions différentes.",
      ["vote"],
    ],
    [
      "Peut-on attribuer une opinion précise à tous ceux qui n’ont pas voté pour ce candidat ?",
      [
        "Non, les raisons et comportements peuvent être différents",
        "Oui, ils pensent tous exactement la même chose",
        "Oui, ils soutiennent tous le deuxième",
        "Oui, ils ont tous voté blanc",
      ],
      "Les catégories du vote distinguent participation, abstention et bulletins. Elles ne révèlent pas à elles seules toutes les motivations.",
      "Un résultat électoral ne remplace pas une enquête sur les opinions.",
      ["vote"],
    ],
  ],
);
writeFileSync(
  new URL("../content/published.json", import.meta.url),
  JSON.stringify(published, null, 2) + "\n",
);
console.log(Object.keys(published).length + " quiz complets");
