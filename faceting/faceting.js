let marked = require('marked'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');

let dataDir = 'd:/rebulas/faceting-data';

fs.readdir(dataDir, (err, files) => {
  async.forEach(files, (file, cb) => {
    fs.readFile(path.join(dataDir, file), 'utf-8',
                (err, content) => {
                  processFile(file, content);
                  cb();
                });
  }, postProcess);
});

/*
Lexeme types:
type: 'code',
type: 'code',
type: 'heading',
type: 'table',
type: 'heading',
type: 'hr'
type: 'blockquote_start'
type: 'blockquote_end'
type: 'loose_item_start'
type: 'loose_item_end'

type: 'list_start',
type: 'list_item_start'
type: 'list_item_end'
type: 'list_end'

type: 'table',
type: 'paragraph',
type: 'text'
*/

function isPlainList(lexemes) {
  // If the content is just a list - definitely facet-able
  // Is just a list if starts with list_start, ends with list_end
  // and no lexemes are outside a (list_item_begin, list_item_end)
  if(!(lexemes[0].type === 'list_start' &&
       lexemes[lexemes.length - 1].type === 'list_end'))
    return false;

  let level = 0;
  return lexemes.every((lex, index) => {
    if(index === 0 || index === lexemes.length - 1)
      return true;

    switch(lex.type) {
    case 'list_item_start':
      level++;
      return true;
    case 'list_item_end':
      level--;
      return true;
    default:
      return level !== 0;
    }
  });
}

function isList(lexemes) {
  return lexemes && isPlainList(lexemes);
}

function processFile(file, content) {
  console.log(file); console.log();
  let lexer = new marked.Lexer();
  let lexemes = lexer.lex(content);
  let topHeadings = [];

  // Gather top-level headings
  lexemes.forEach((lexeme, index) => {
    let isTopLevelHeading = lexeme.type === 'heading' &&
        topHeadings.indexOf(lexeme.text) &&
        lexeme.depth === 1;

    if(isTopLevelHeading) {
      topHeadings.push({
        text: lexeme.text,
        index: index
      });
    }
  });

  // Gather text values for each top-level heading
  topHeadings.forEach((heading, index) => {
    let nextHeading = topHeadings[index + 1];
    let valueLexemes = lexemes.slice(heading.index + 1,
                                     (nextHeading && nextHeading.index) || lexemes.length);
    appendFieldStats(heading.text, valueLexemes);
  });
}

function tokenize(text) {
  let split = text.split(',');
  return split.map((s) => s.split(' ').map((s) => s.trim()));
}

function sentenceSplit(text) {
  return text.split(/\.($| )/);
}

let fieldStats = {};
function appendFieldStats(heading, valueLexemes) {
  let isListOnly = isList(valueLexemes);
  fieldStats[heading] = fieldStats[heading] || {
    tokenLengths: [],
    sentenceCount: 0,
    isList: isListOnly
  };
  let stats = fieldStats[heading];
  if(isListOnly) return;

  valueLexemes.forEach((lex) => {
    if(!lex.text) return;
    let sentCount = sentenceSplit(lex.text).length;
    stats.sentenceCount += sentCount <= 1 ? 0 : sentCount;
    tokenize(lex.text).forEach((token) => stats.tokenLengths.push(token.length));
  });
}

function mean(arr) {
  return arr.reduce((t, v) => t + v, 0) / arr.length;
}

function variance(arr) {
  let avg = mean(arr);
  return mean(arr.map((v) => Math.pow(v - avg, 2)));
}

function postProcess() {
  Object.keys(fieldStats).forEach((key) => {
    let fieldName = key, stats = fieldStats[key];
    let lengths = stats.tokenLengths;

    let avg = mean(lengths);
    console.log(key,
                'Avg:', avg,
                'Var:', variance(lengths),
                'Sentences:', stats.sentenceCount);
    saveLengths(key, lengths);
  });
}

function saveLengths(key, lengths) {
  let data = lengths.join('\n');
  fs.writeFileSync(key + '.txt', data, 'utf-8');
}
