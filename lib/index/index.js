
/**
 * @property postings - Map field name -> (Map token -> doc list)
 * @property documents - Map docId -> document
 * @property maxDocId
 */
class ReverseIndex {
  constructor() {
    this.postings = new Map();
    this.documents = new Map();
    this.maxDocId = 0;
  }

  add(document) {
    var docId = ++ this.maxDocId;

    document.id = docId;
    this.documents.set(docId, document);

    ensurePostingsForFields(this.postings, document);

    forDocumentFieldTokenPostings(document, this.postings, (docField, token, fieldTokenPostings) => {
      let index = fieldTokenPostings.indexOf(docId);
      if(index < 0) {
        fieldTokenPostings.push(docId);
        fieldTokenPostings.sort();
      }
    });

    return document;
  }

  remove(docOrId) {
    let id,
        document;
    if(Number(docOrId) === docOrId) {
      id = docOrId;
      document = this.documents.get(id);
    } else {
      document = docOrId;
      id = docOrId.id;
    }

    forDocumentFieldTokenPostings(document, this.postings, (docField, token, fieldTokenPostings) => {
      let index = fieldTokenPostings.indexOf(id);
      if(index >= 0) {
        fieldTokenPostings.splice(index, 1);
      }
    }, true);

    this.documents.delete(id);
  }

  query(queryObject) {
    let postings = [],
        tokenCount = 0;
    forDocumentFieldTokenPostings(queryObject, this.postings, (docField, token, fieldTokenPostings) => {
      postings = postings.concat(fieldTokenPostings);
      tokenCount++;
    });
    postings.sort();

    let docIds = documentsWithOccurrences(postings,
                                          lowerBoundOccurrencesFromQuery(queryObject, tokenCount));
    return docIds.map((docId) => this.documents.get(docId));

    function documentsWithOccurrences(postings, lowerBoundOccurrence) {
      let docIds = [],
          currentDoc = postings[0],
          occurrences = 0;

      postings.forEach((docId) => {
        if(docId === currentDoc) {
          occurrences++;
        } else {
          if(occurrences >= lowerBoundOccurrence)
            docIds.push(docId);

          currentDoc = docId;
          occurrences = 1;
        }
      });
      if(occurrences >= lowerBoundOccurrence)
        docIds.push(postings[postings.length - 1]);

      return docIds;
    }

    function lowerBoundOccurrencesFromQuery(queryObject, tokenCount) {
      switch(queryObject.type) {
      case 'and':
        // Document should have occurred at least once for every token in the query
        return tokenCount;
      case 'or':
      default:
        // Document should have occurred at least once
        return 1;
      }
    }
  }
}

function forDocumentFieldTokenPostings(document, indexPostings, iterator) {
  Object.keys(document.fields).forEach((docField) => {
    let fieldPostingsList = indexPostings.get(docField);
    document.fields[docField].forEach((token) => {
      let postings = fieldPostingsList.get(token);

      if(!postings) {
        postings = [];
        fieldPostingsList.set(token, postings);
      }

      iterator(docField, token, fieldPostingsList.get(token));

      if(!postings.length) {
        fieldPostingsList.delete(token);
      }
    });

    if(fieldPostingsList.size === 0) {
      indexPostings.delete(docField);
    }
  });
}

function ensurePostingsForFields(postings, document) {
  Object.keys(document.fields).forEach((docField) => {
    postings.set(docField,
                 postings.get(docField) || new Map());
  });
}

function analyze(text) {

}

var sampleDocument = {
  fields: {
    tags: ['test', 'tag'],
    head: [ 'heading' ],
    body: [ 'this', 'is', 'a', 'body' ]
  },
  id: 0
};

module.exports = {
  ReverseIndex: ReverseIndex,
  analyze: analyze
};
