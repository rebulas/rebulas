module.exports = {

  element : function(name, classes) {
    var el = $(document.createElement(name));
    if (classes) {
      el.addClass(classes);
    }

    return el;
  },

  ul : function(classes) {
    return this.element("ul", classes);
  },

  li : function(classes) {
    return this.element("li", classes);
  },

  div : function(classes) {
    return this.element("div", classes);
  },

  a : function(classes) {
    return this.element("a", classes);
  },

  span : function(classes) {
    return this.element("span", classes);
  },

  br : function(classes) {
    return this.element("br", classes);
  },

  em : function(classes) {
    return this.element("em", classes);
  },

  textArea : function(classes) {
    return this.element("textarea", classes);
  },

  textInput : function(classes) {
    var el = this.element("input", classes);
    el.attr("type", "text");

    return el;
  },

  searchInput : function(classes) {
    var el = this.element("input", classes);
    el.attr("type", "search");

    return el;
  },

  button : function(classes) {
    var el = this.element("button", classes);
    el.attr("type", "button");

    return el;
  }
}
