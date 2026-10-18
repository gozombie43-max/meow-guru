const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const asString = input => ({ $convert: { input, to: 'string', onError: '', onNull: '' } });
const asNumber = (input, fallback = 0) => ({ $convert: { input, to: 'int', onError: fallback, onNull: fallback } });

// Prefer published metadata, with title parsing for older uploaded papers.
export const pyqCatalogSort = [
  { $set: {
    _examDate: { $convert: { input: { $ifNull: ['$examDate', '$paperMetadata.examDate'] }, to: 'date', onError: null, onNull: null } },
    _titleDate: { $regexFind: { input: { $toUpper: { $ifNull: ['$title', ''] } }, regex: '\\b([0-3]?\\d)[\\s./-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\\b' } },
    _titleYear: { $regexFind: { input: { $ifNull: ['$title', ''] }, regex: '\\b((?:19|20)\\d{2})\\b' } },
    _shiftMatch: { $regexFind: { input: { $toUpper: { $cond: [
      { $ne: [{ $ifNull: ['$shift', null] }, null] }, { $concat: ['SHIFT ', asString('$shift')] }, { $ifNull: ['$title', ''] },
    ] } }, regex: 'SHIFT\\s*[-:]?\\s*(\\d+)' } },
  } },
  { $set: {
    _sortYear: { $ifNull: ['$_year', { $ifNull: [{ $year: '$_examDate' }, asNumber({ $arrayElemAt: ['$_titleYear.captures', 0] })] }] },
    _sortDay: { $ifNull: [asNumber({ $dateToString: { date: '$_examDate', format: '%m%d' } }, null), {
      $cond: [{ $ne: ['$_titleDate', null] }, { $add: [
        { $multiply: [{ $add: [{ $indexOfArray: [months, { $arrayElemAt: ['$_titleDate.captures', 1] }] }, 1] }, 100] },
        asNumber({ $arrayElemAt: ['$_titleDate.captures', 0] }),
      ] }, 9999],
    }] },
    _sortShift: asNumber({ $arrayElemAt: ['$_shiftMatch.captures', 0] }, 9999),
  } },
  { $sort: { _sortYear: -1, _sortDay: 1, _sortShift: 1, order: 1, id: 1 } },
];

export const pyqSortProjection = { _examDate: 0, _titleDate: 0, _titleYear: 0, _shiftMatch: 0, _sortYear: 0, _sortDay: 0, _sortShift: 0 };
