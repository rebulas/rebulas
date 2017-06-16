var Keymap = {

  "lastChar" : undefined,
  "lastCharTimestamp" : 0,

  // We'll be capturing double Ctrl press, limited within 300ms
  "lastCtrlTimestamp" : 0,

  // Holds the dynamic keymap two-letter-combination -> function
  "table" : {},

  "active" : false,

  "create" : function(args) {
    this.terminal = args.terminal;

    $(document).on("keyup", e => {
      this.handleCtrl(e);

      // Process dynamic shortcuts
      if (this.active) {
        this.process(e);
      }
    });

    // Map the links upon load
    this.mapAll();

    var self = this;
    return {
      "onResultChange" : function(result) {

        // Remap the shortcuts on result change
        self.table = {}
        self.mapAll();
      }
    }
  },

  "activateShortcuts" : function() {
    this.active = true;
    $(".keyboard-hint").show();
  },

  "deActivateShortcuts" : function() {
    this.active = false;
    $(".keyboard-hint").hide();
  },

  "handleCtrl" : function(e) {
    // A really stupid way to detect if the terminal is focused. Could not find any reasonable utility to do this
    // We need to distinguish between double control key press when the terminal is focused (blurs the terminal) and
    // the same event when the terminal is not focused (focuses the terminal)
    //
    // In this case the JQuery terminal happens to have a text area that has the class "clipboard". During upgrades
    // of the library this may fail
    let terminalFocused = document.activeElement.getAttribute("class") == "clipboard";

    if (e.which == 17 && !terminalFocused) {
      let now = new Date().getTime();
      if (now - this.lastCtrlTimestamp > 300) {
        this.lastCtrlTimestamp = now;
      } else {
        // Double Ctrl key press
        this.terminal.focus();
      }
    }
  },

  "process" : function(e) {
    let now = new Date().getTime();

    // We're using only letters for the keyboard shortcuts
    if (e.which < 65) {
      return;
    }

    let first = this.table[this.lastChar];
    if (first && now - this.lastCharTimestamp < 300) {
      let second = e.which;
      let func = first[second];
      if (func) {
        func();
      }
    } else {
      this.lastChar = e.which;
      this.lastCharTimestamp = now;
    }
  },

  "assign" : function(first, second, func) {
    // event.which reports only upper case, add the mapped keys to the table
    var firstChar = first.toUpperCase().charCodeAt(0);
    var secondChar = second.toUpperCase().charCodeAt(0);

    var top = this.table[firstChar];
    if (!top) {
      this.table[firstChar] = {};
      this.table[firstChar][secondChar] = func;
    } else {
      this.table[firstChar][secondChar] = func;
    }
  },

  "mapAll" : function() {
    let table = ["a", "s", "d", "f", "j", "k", "l", "g", "h", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
    let i = 0;
    let j = 0;
    let k = 0;
    var self = this;

    // Have these separate, we want the best combinations for the item list, facets are secondary
    var elements = $(".focusable-link").toArray().concat($(".focusable-facet").toArray());

    elements.forEach(elem => {

      // We'll use two-letter combinations and bind them to keyboard shortcuts for fast navigation
      let sym = undefined;

      // First use double-same-letter combinations
      if (i < table.length) {
          let c = table[i++];
          sym = [c, c];
      } else {
          // Starting from the beginning of the table combine the letters in pairs
          if (j < table.length) {
            let first = table[j];
            if (k == j) {
              k += 1;
            }
            let second = table[k++];

            sym = [first, second];
            if (k == table.length) {
              j++;
              k = 0;
            }
          }
      }

      if (sym) {
        // Callback to active onclick
        let id = $(elem).attr("id");
        let callback = function() {
          $("#" + id).click();
        };

        self.assign(sym[0], sym[1], callback);

        var div = Elements.div("keyboard-hint");
        div.append(sym[0] + sym[1]);
        div.hide();

        $(elem).css("position", "relative");
        $(elem).append(div);
      }
    })
  }
}
