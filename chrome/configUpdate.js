// Updater events:
//   error
//   updating
//   complete
//   success
//   itemupdated
//   progress
// properties:
//   status
//   lastUpdate


//var server = "http://settings.np-activex.googlecode.com/hg/";
var server="http://localhost:5454/setting/";

var serverConfig = {
  setting: [
  ],
  scripts: [
  ],
  timestamp: {
    setting: -1,
    scripts: -1
  },
  lastUpdate: 0
};

// Update per 5 hours.
var interval = 1000 * 3600 * 5;

function UpdateSession() {
  var val = $({});
  val.__proto__ = UpdateSession.prototype;
  val.reset();
  val.updateToken = undefined;
  return val;
}

UpdateSession.prototype = {
  __proto__: $({}).__proto__,

  start: function() {
    this.update();
  },

  onUpdateError: function(xhr, msg, thrown) {
    ++this.error;
    updater.trigger('error', [xhr, msg, thrown]);
    this.updateProgress();
  },

  progress: function() {
    ++this.finished;
    this.updateProgress();
  },

  updateProgress: function() {
    with(this) {
      if (error + finished == total) {
        updater.trigger('complete', [finished, total]);
      } else {
        updater.trigger('progress', [finished, total, error]);
      }
    }
  },

  updateFile: function(request) {
    ++this.total;
    var a = this;

    if (request.url.match(/^.*:\/\//) == null) {
      request.url = server + request.url;
    }
    if (!request.ifModified) {
      request.ifModified = true;
    }

    var old_success = request.success;
    request.success = function(nv, status, xhr) {
      if (old_success && status == 'success') {
        old_success.call(this, nv, status, xhr);
      }
      a.progress();
    }

    var old_error = request.error;
    request.error = function(jqXHR, textStatus, errorThrown) {
      if (old_error && status == 'success') {
        old_error.call(this, jqXHR, textStatus, errorThrown);
      }
      a.onUpdateError(jqXHR, textStatus, errorThrown);
    }
    $.ajax(request)
  },

  reset: function() {
    this.finished = this.total = this.error = 0;
    this.items = {};
  },

  update: function() {
    with(this) {
      if (updateToken) {
        clearTimeout(updateToken);
        updateToken = undefined;
      }
      doUpdate();
      updateToken = setTimeout(update, interval);
    }
  },

  doUpdate: function() {
    with(this) {
      reset();
      trigger('updating');

      updateFile({
        url: 'setting.json',
        success: function(nv, status, xhr) {
          trigger('itemupdated', ['setting', nv]);
        }
      });

      updateFile({
        url: 'scripts.json',
        success: function(nv, status, xhr) {
          trigger('itemupdated', ['scripts', nv]);
        }
      });
    }
  }
}

UpdateSession.prototype.__defineGetter__('status', function() {
  if (this.finished + this.error == this.total) {
    return "stop";
  } else {
    return "updating";
  }
});

updater = new UpdateSession();

updater.bind('success', function() {
    setting.misc.lastUpdate = Date.now();
});

updater.bind('complete', function(e, finished, total) {
  if (finished == total) {
    updater.trigger('success');
  }
});

updater.bind('updating', function() {
  console.log('updating');
});

updater.bind('itemupdated', function(e, item, nv) {
  console.log('itemUpdated ' + item);
  updater.items[item] = true;
  if (item == 'setting') {
    var old = setting.defaultRules;
    setting.defaultRules = nv;
    setting.update('defaultRules', old);
  } else if (item == 'scripts') {
    var old = setting.scripts;
    setting.scripts = nv;
    setting.update('scripts', old);
  }
  if (updater.items['setting'] && updater.items['scripts']) {
    setting.updateAllScripts();
  }
});
