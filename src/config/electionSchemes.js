const electionSchemes = [
  { code: 'LIRA_MAYOR_2026', label: 'Mayoral tally' },
  { code: 'LIRA_MP_2026', label: 'Member of Parliament' },
  { code: 'LIRA_LC5_2026', label: 'LC 5 Chairperson' },
  { code: 'LIRA_LC3_2026', label: 'LC 3 Chairperson' }
];

const defaultElectionCode = electionSchemes[0].code;

function getElectionScheme(code) {
  return electionSchemes.find((scheme) => scheme.code === code) || electionSchemes[0];
}

function electionCodeAllowed(code) {
  return electionSchemes.some((scheme) => scheme.code === code);
}

function electionLabel(code) {
  return getElectionScheme(code).label;
}

module.exports = {
  electionSchemes,
  defaultElectionCode,
  getElectionScheme,
  electionCodeAllowed,
  electionLabel
};
