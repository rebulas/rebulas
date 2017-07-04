var Util = require("extra/util");
var marked = require("marked");
var model = require('backend/model');

class FeatureCollector {
  static mean(arr) {
    return arr.reduce((t, v) => t + v, 0) / arr.length;
  }

  static variance(arr) {
    let avg = FeatureCollector.mean(arr);
    return FeatureCollector.mean(arr.map((v) => Math.pow(v - avg, 2)));
  }

  static tokenizeFacetField(text) {
    return text.split(/,/).map((s) => s.trim()).filter((t) => t);
  }

  static tokenizeFacetValue(text) {
    return text.split(/ /).map((s) => s.trim()).filter((t) => t);
  }

  static sentenceSplit(text) {
    return text.split(/\.($| )/);
  }

  static isPlainList(lexemes) {
    if(!lexemes.length) {
      return false;
    }
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

  static isList(lexemes) {
    return lexemes && FeatureCollector.isPlainList(lexemes);
  }

  static load(features) {
    let result = new FeatureCollector();
    result.fieldFeatures = features;
    return result;
  }

  static analyzeDocument(content) {
    let lexer = new marked.Lexer(),
        lexemes = lexer.lex(content),
    topHeadings = [],
    topHeadingsValues = [];

    // Gather top-level headings, these will be considered
    // for field names, i.e. facet names
    lexemes.forEach((lexeme, index) => {
      let isTopLevelHeading = lexeme.type === 'heading' &&
          lexeme.depth === 1 &&
          topHeadings.indexOf(lexeme.text) < 0;

      if(isTopLevelHeading) {
        topHeadings.push({
          text: lexeme.text,
          index: index
        });
      }
    });
    // Gather text values for each top-level heading,
    // these will be consiedered for field values, i.e. facet values
    topHeadings.forEach((heading, index) => {
      let nextHeading = topHeadings[index + 1];
      let valueLexemes = lexemes.slice(heading.index + 1,
                                       (nextHeading && nextHeading.index) || lexemes.length);
      topHeadingsValues.push(valueLexemes);
    });

    let result = {
      topHeadings: topHeadings,
      topHeadingsValues: topHeadingsValues,
      lexemes: lexemes
    };

    // Use first top-level heading as the "name"
    if (topHeadings && topHeadingsValues) {
      let nameIndex = topHeadingsValues.findIndex((vals) => vals),
          nameField = topHeadings[nameIndex].text,
          nameValue = topHeadingsValues[nameIndex][0];

      result.heading = {
        name : nameField,
        value : nameValue ? nameValue.text : ''
      };
    }

    return result;
  }

  constructor() {
    this.fieldFeatures = {};
  }

  toJSON() {
    return this.fieldFeatures;
  }

  addDocContent(content) {
    let self = this,
        fieldFeatures = this.fieldFeatures,
        addedDoc = {},
        analyzedDoc = new model.AnalyzedItem(null, content);

    // Gather text values for each top-level heading
    analyzedDoc.fields.forEach((field) => {
      appendFieldStats(field.name, field.lexemes);

      let fieldValue = field.lexemes.map((l) => l.text ? l.text : '').join(' ');
      addedDoc[field.name] = fieldValue;
    });
    return addedDoc;

    function appendFieldStats(fieldKey, valueLexemes) {
      fieldFeatures[fieldKey] = fieldFeatures[fieldKey] || {
        values: {},
        sentenceCount: 0,
        docCount: 0,
        plainListDocs: 0
      };

      let stats = fieldFeatures[fieldKey];
      stats.docCount++;
      if(FeatureCollector.isList(valueLexemes))
        stats.plainListDocs++;

      valueLexemes.forEach((lex) => {
        if(!lex.text) return;
        let sentCount = FeatureCollector.sentenceSplit(lex.text).length;
        // single-sentence values don't count
        stats.sentenceCount += sentCount <= 1 ? 0 : sentCount;

        FeatureCollector.tokenizeFacetField(lex.text).forEach((token) => {
          let id = token.toLowerCase();
          stats.values[id] = stats.values[id] || {
            id: id,
            value: token,
            count: 0
          };
          stats.values[id].count++;
        });
      });
    }
  }

  removeDocContent(content) {
    let fieldFeatures = this.fieldFeatures,
        analyzedDoc = new model.AnalyzedItem(null, content);

    analyzedDoc.fields.forEach((field) => {
      removeFieldStats(field.name, field.lexemes);
    });

    function removeFieldStats(fieldKey, valueLexemes) {
      let stats = fieldFeatures[fieldKey];
      stats.docCount--;
      if(FeatureCollector.isList(valueLexemes))
        stats.plainListDocs--;

      valueLexemes.forEach((lex) => {
        if(!lex.text) return;
        let sentCount = FeatureCollector.sentenceSplit(lex.text).length;
        stats.sentenceCount -= sentCount <= 1 ? 0 : sentCount;

        FeatureCollector.tokenizeFacetField(lex.text).forEach((token) => {
          let id = token.toLowerCase();
          if(stats.values[id]) {
            stats.values[id].count--;
            if(stats.values[id].count === 0)
              delete stats.values[id];
          }
        });
      });
    }
  }

  calculateFieldFeatures() {
    Util.log('Calculating field features');
    let fieldFeatures = this.fieldFeatures;
    Object.keys(fieldFeatures).forEach((key) => {
      let fieldName = key,
      stats = fieldFeatures[key],
      lengths = Object.keys(stats.values).map((t) => FeatureCollector.tokenizeFacetValue(t).length);

      let avg = FeatureCollector.mean(lengths),
      variance = FeatureCollector.variance(lengths);
      Util.log(key,
               'Avg:', avg,
               'Var:', variance,
               'Sentences:', stats.sentenceCount);

      // Pretty much the only feature...
      stats.isFacet = stats.docCount === stats.plainListDocs || variance < 1;
    });
    return fieldFeatures;
  }

  calculateResultFacets(documents) {
    Util.log('Calculating result facets over', documents.length, 'items');
    let resultFacets = {},
        features = this.fieldFeatures;

    Object.keys(features).forEach((key) => {
      let stats = features[key];
      if(!stats.isFacet) return;

      documents.forEach((doc) => populateFacets(doc, resultFacets, key, features[key]));
    });
    return resultFacets;

    function populateFacets(doc, facets, field, fieldStats) {
      facets[field] = facets[field] || {};
      let facet = facets[field];
      let docValue = (doc[field] && FeatureCollector.tokenizeFacetField(doc[field])) || [];

      (docValue).forEach((t) => {
        let fieldValueStat = fieldStats.values[t.toLowerCase()];
        if(!fieldValueStat)
          return;
        facet[t] = facet[t] || { count: 0, value: t, id: fieldValueStat.id };
        facet[t].count++;
      });
    }
  }
}

module.exports.FeatureCollector = FeatureCollector;
