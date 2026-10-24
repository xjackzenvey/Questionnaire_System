// Older imports stored section headings in the question title.
export function questionParts(question) {
  if (question.sectionTitle !== undefined)
    return { sectionTitle: question.sectionTitle, title: question.title };
  const match = question.title.match(/^(第[一二三四五六七八九十百\d]+部分[：:][^｜|]+)[｜|]\s*(.+)$/);
  return match
    ? { sectionTitle: match[1].trim(), title: match[2].trim() }
    : { sectionTitle: "", title: question.title };
}
