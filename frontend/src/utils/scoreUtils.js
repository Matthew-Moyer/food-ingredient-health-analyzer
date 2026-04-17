export const getScoreTone = (score = 0) => {
  if (score >= 80) {
    return "score-good";
  }

  if (score >= 65) {
    return "score-medium";
  }

  return "score-low";
};

export const formatScore = (score = 0) => `${score}/100`;
