var ResultModel = {

  "create" : function() {

    return {
      "result" : undefined,

      "set" : function(model) {
          this.result = model;
      },

      "get" : function() {
        return this.result;
      }
    }
  }
}
