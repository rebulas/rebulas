var Elements = {

  element : function(name, classes) {
    var el = $(document.createElement(name));
    if (classes) {
      el.addClass(classes);
    }

    return el;
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

  textInput : function(classes) {
    var el = this.element("input", classes);
    el.attr("type", "text");

    return el;
  },

  button : function(classes) {
    var el = this.element("button", classes);
    el.attr("type", "button");

    return el;
  }
}
