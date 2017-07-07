let marked = require('marked');

function toEntryName(id) {
  let split = id.split('/');
  return split[split.length - 1];
}

class CatalogItemEntry {
  constructor(id, rev) {
    this.id = id;
    this.rev = rev || 'local';
    this._name = '';
  }

  get name() {
    return this._name || toEntryName(this.id);
  }

  set name(name) {
    this._name = name;
  }
}

class CatalogItem extends CatalogItemEntry {
  constructor(id, rev, content) {
    super(id, rev);
    this.content = content;
  }

  toJSON() {
    return Object.assign({}, this);
  }

  fromJSON(json) {
    Object.assign(this, json);
    return this;
  }
}

class BaseCatalogOperations {
  constructor(catalog) {
    let path = catalog.path || "/";
    if (path[0] != "/") {
      path = "/" + path;
    }

    this.path = path;
    this.indexFile = path + '/.rebulas_index';
  }

  get indexId() {
    return this.indexFile;
  }

  // Return an array of CatalogItemEntry
  listItems() {
    return Promise.reject(new Error());
  }

  saveItem(catalogItem) {
    return Promise.reject(new Error());
  }

  getItem(catalogItem) {
    return Promise.reject(new Error());
  }
}

class AnalyzedItem {
  constructor(id, rawContent) {
    this.id = id;
    this.setContent(rawContent);
  }

  setContent(rawContent) {
    this.rawContent = rawContent;
    let lexer = new marked.Lexer(),
        lexemes = lexer.lex(rawContent),
        topHeadings = [];

    // Gather top-level headings, these will be considered
    // for field names, i.e. facet names
    lexemes.forEach((lexeme, index) => {
      let isTopLevelHeading = lexeme.type === 'heading' &&
        lexeme.depth === 1 &&
        topHeadings.indexOf(lexeme.text) < 0;

      if(isTopLevelHeading) {
        topHeadings.push({
          text: lexeme.text.toLowerCase(),
          index: index
        });
      }
    });

    // Gather text values for each top-level heading,
    // these will be consiedered for field values, i.e. facet values
    this.fields = [];
    topHeadings.forEach((heading, index) => {
      let nextHeading = topHeadings[index + 1];
      let valueLexemes = lexemes.slice(heading.index + 1,
                                       (nextHeading && nextHeading.index) || lexemes.length);
      this.fields.push(new DocumentField(heading.text.toLowerCase(), valueLexemes));
    });
  }

  field(name) {
    return this.fields.find((f) => f.name === name);
  }
}

class DocumentField {
  constructor(name, valueLexemes) {
    this.name = name;
    this.valueLexemes = valueLexemes;
  }

  get textValue() {
    // TODO: Improve how the text value is collected
    return this.valueLexemes.map((l) => l.text || '').join(' ');
  }

  get lexemes() {
    return this.valueLexemes;
  }
}

class DisplayItem extends AnalyzedItem {
  constructor(id, rawContent) {
    super(id, rawContent);
  }
}

module.exports = {
  CatalogItemEntry: CatalogItemEntry,
  CatalogItem: CatalogItem,
  BaseCatalogOperations: BaseCatalogOperations,
  AnalyzedItem: AnalyzedItem,
  DisplayItem: DisplayItem,
  toEntryName: toEntryName
};
