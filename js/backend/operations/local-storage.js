module.exports = {

  getItem : function(id) {
    return window.localStorage.getItem(id);
  },

  setItem : function(id, data) {
    return window.localStorage.setItem(id, data);
  }
}
